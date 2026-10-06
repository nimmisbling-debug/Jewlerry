import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OrderStatusValue } from "@/types/database";

export async function createOrderRpc(
  supabase: SupabaseClient<Database>,
  params: {
    /** Null for a guest checkout. */
    customerId: string | null;
    items: { productId: number; quantity: number }[];
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    shippingAddress: string;
    shippingCity?: string | null;
    shippingNotes?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("create_order", {
    p_customer_id: params.customerId,
    p_items: params.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_customer_name: params.customerName,
    p_customer_phone: params.customerPhone,
    p_customer_email: params.customerEmail,
    p_shipping_address: params.shippingAddress,
    p_shipping_city: params.shippingCity ?? null,
    p_shipping_notes: params.shippingNotes ?? null,
  });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, order: data };
}

export async function changeOrderStatusRpc(
  supabase: SupabaseClient<Database>,
  params: { orderId: number; newStatus: OrderStatusValue; changedBy: string | null; reason?: string | null },
) {
  const { data, error } = await supabase.rpc("change_order_status", {
    p_order_id: params.orderId,
    p_new_status: params.newStatus,
    p_changed_by: params.changedBy,
    p_reason: params.reason ?? null,
  });

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, order: data };
}

/**
 * create_order raises structured exception messages (see migration 0005)
 * — this turns them into something a customer can actually act on,
 * instead of a raw Postgres error.
 */
export function friendlyCreateOrderError(message: string): string {
  if (message.startsWith("INSUFFICIENT_STOCK:")) {
    const [, , name, available] = message.split(":");
    return `Only ${available} of "${name}" left in stock — please update the quantity in your cart.`;
  }
  if (message.startsWith("PRODUCT_NOT_FOUND:")) {
    return "One of the items in your cart is no longer available. Please remove it and try again.";
  }
  if (message === "ORDER_EMPTY") {
    return "Your cart is empty.";
  }
  if (message === "ORDER_INVALID_ITEM") {
    return "Something's wrong with an item in your cart. Please refresh and try again.";
  }
  return "Could not place your order. Please try again.";
}
