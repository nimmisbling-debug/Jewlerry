import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import type { Database, OrderStatusValue, PaymentTypeValue } from "@/types/database";

export interface CartLineDetail {
  productId: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPrice: number;
  priceBeforeDiscount: number;
  requestedQuantity: number;
  availableStock: number;
  isActive: boolean;
  /** False if the product was deleted since it was added to the cart. */
  exists: boolean;
}

/**
 * Rule 8: the cart itself lives in localStorage (just productId +
 * quantity), and is NEVER trusted for price or stock — this re-fetches
 * both fresh from the server every time the cart/checkout is opened. A
 * missing or inactive product is flagged (exists/isActive: false) so the
 * UI can prompt the customer to remove it rather than silently dropping it.
 */
export async function refreshCartDetails(
  items: { productId: number; quantity: number }[],
  supabaseClient?: SupabaseClient<Database>,
): Promise<CartLineDetail[]> {
  if (items.length === 0) return [];

  const supabase = supabaseClient ?? (await createServerSupabaseClient());
  const ids = items.map((i) => i.productId);

  const [{ data: products }, { data: images }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, price_after_discount, price_before_discount, quantity_in_stock, is_active")
      .in("id", ids),
    supabase
      .from("product_images")
      .select("product_id, url, display_order")
      .in("product_id", ids)
      .order("display_order"),
  ]);

  const imageByProduct = new Map<number, string>();
  for (const img of images ?? []) {
    if (!imageByProduct.has(img.product_id)) imageByProduct.set(img.product_id, img.url);
  }
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return items.map((item): CartLineDetail => {
    const product = productById.get(item.productId);

    if (!product || !product.is_active) {
      return {
        productId: item.productId,
        name: "Product no longer available",
        slug: "",
        imageUrl: null,
        unitPrice: 0,
        priceBeforeDiscount: 0,
        requestedQuantity: item.quantity,
        availableStock: 0,
        isActive: false,
        exists: !!product,
      };
    }

    return {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: imageByProduct.get(product.id) ?? null,
      unitPrice: product.price_after_discount,
      priceBeforeDiscount: product.price_before_discount,
      requestedQuantity: item.quantity,
      availableStock: product.quantity_in_stock,
      isActive: true,
      exists: true,
    };
  });
}

// =============================================================================
// Order history / detail — RLS (own orders, or admin) does the access
// control here; these queries never take a customerId param for the
// "my orders" case because there's no need to — the caller's own session
// client only ever sees what RLS allows it to see.
// =============================================================================

export interface OrderListItem {
  id: number;
  orderNumber: string;
  invoiceNumber: string;
  status: OrderStatusValue;
  total: number;
  currencyCode: string;
  itemCount: number;
  createdAt: string;
  customerName: string;
}

export interface OrderListResult {
  items: OrderListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface OrderSearchFilters {
  status?: OrderStatusValue;
  customerId?: string;
  q?: string; // order number or invoice number
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Shared by the customer "My Orders" page (no filters beyond pagination —
 * RLS already scopes it to their own rows) and the admin orders table
 * (any filter, any customer).
 */
export async function searchOrders(
  supabase: SupabaseClient<Database>,
  filters: OrderSearchFilters = {},
): Promise<OrderListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("orders")
    .select("id, order_number, invoice_number, status, total, currency_code, created_at, customer_name", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.q) {
    query = query.or(`order_number.ilike.%${filters.q}%,invoice_number.ilike.%${filters.q}%`);
  }

  const { data, count, error } = await query.range(from, from + pageSize - 1);

  if (error || !data) {
    if (error) console.error("[searchOrders] failed:", error);
    return { items: [], totalCount: 0, page, pageSize, pageCount: 1 };
  }

  const orderIds = data.map((o) => o.id);
  const itemCounts = await batchCountOrderItems(supabase, orderIds);

  const totalCount = count ?? 0;
  return {
    items: data.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      invoiceNumber: o.invoice_number,
      status: o.status,
      total: o.total,
      currencyCode: o.currency_code,
      createdAt: o.created_at,
      customerName: o.customer_name,
      itemCount: itemCounts.get(o.id) ?? 0,
    })),
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

async function batchCountOrderItems(
  supabase: SupabaseClient<Database>,
  orderIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (orderIds.length === 0) return map;

  const { data } = await supabase.from("order_items").select("order_id, quantity").in("order_id", orderIds);
  for (const row of data ?? []) {
    map.set(row.order_id, (map.get(row.order_id) ?? 0) + row.quantity);
  }
  return map;
}

export interface OrderItemDetail {
  id: number;
  productId: number | null;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusEvent {
  id: number;
  oldStatus: OrderStatusValue | null;
  newStatus: OrderStatusValue;
  reason: string | null;
  createdAt: string;
}

export interface OrderDetail {
  id: number;
  orderNumber: string;
  invoiceNumber: string;
  customerId: string;
  status: OrderStatusValue;
  subtotal: number;
  shippingCost: number;
  total: number;
  currencyCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string | null;
  shippingNotes: string | null;
  returnReason: string | null;
  returnNotes: string | null;
  returnedAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
  /** Sum of approved payments. */
  amountPaid: number;
  /** total - amountPaid: still owed, collected as cash on delivery when paymentType is "delivery_fee". */
  balanceDue: number;
  /** Type of the most recent approved payment, or null if nothing is approved yet. */
  paymentType: PaymentTypeValue | null;
  items: OrderItemDetail[];
  statusHistory: OrderStatusEvent[];
}

/** Returns null if the order doesn't exist OR isn't visible to the caller under RLS. */
export async function getOrderById(
  supabase: SupabaseClient<Database>,
  orderId: number,
): Promise<OrderDetail | null> {
  const [{ data: order, error }, { data: items }, { data: history }, { data: approvedPayments }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).single(),
    supabase
      .from("order_items")
      .select("id, product_id, product_name_snapshot, product_image_snapshot_url, unit_price_snapshot, quantity, line_total")
      .eq("order_id", orderId),
    supabase
      .from("order_status_history")
      .select("id, old_status, new_status, reason, created_at")
      .eq("order_id", orderId)
      .order("created_at"),
    supabase
      .from("payments")
      .select("amount, payment_type")
      .eq("order_id", orderId)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  ]);

  if (error || !order) return null;

  const amountPaid = (approvedPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    id: order.id,
    orderNumber: order.order_number,
    invoiceNumber: order.invoice_number,
    customerId: order.customer_id,
    status: order.status,
    subtotal: order.subtotal,
    shippingCost: order.shipping_cost,
    total: order.total,
    currencyCode: order.currency_code,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    shippingAddress: order.shipping_address,
    shippingCity: order.shipping_city,
    shippingNotes: order.shipping_notes,
    returnReason: order.return_reason,
    returnNotes: order.return_notes,
    returnedAt: order.returned_at,
    cancelledReason: order.cancelled_reason,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    amountPaid,
    balanceDue: Math.max(0, Number(order.total) - amountPaid),
    paymentType: approvedPayments?.[0]?.payment_type ?? null,
    items: (items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.product_name_snapshot,
      imageUrl: i.product_image_snapshot_url,
      unitPrice: i.unit_price_snapshot,
      quantity: i.quantity,
      lineTotal: i.line_total,
    })),
    statusHistory: (history ?? []).map((h) => ({
      id: h.id,
      oldStatus: h.old_status,
      newStatus: h.new_status,
      reason: h.reason,
      createdAt: h.created_at,
    })),
  };
}
