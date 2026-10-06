import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import type { Database, PaymentMethodType, PaymentStatusValue, PaymentTypeValue } from "@/types/database";

export interface PaymentMethodDetail {
  id: number;
  type: PaymentMethodType;
  name: string;
  accountHolderName: string | null;
  accountNumber: string | null;
  iban: string | null;
  bankName: string | null;
  instructions: string | null;
  isActive: boolean;
  displayOrder: number;
  swiftCode: string | null;
  branchCode: string | null;
  qrCodeUrl: string | null;
}

function mapPaymentMethod(row: {
  id: number;
  type: PaymentMethodType;
  name: string;
  account_holder_name: string | null;
  account_number: string | null;
  iban: string | null;
  bank_name: string | null;
  instructions: string | null;
  is_active: boolean;
  display_order: number;
  payment_method_details: {
    swift_code: string | null;
    branch_code: string | null;
    qr_code_url: string | null;
  } | null;
}): PaymentMethodDetail {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    accountHolderName: row.account_holder_name,
    accountNumber: row.account_number,
    iban: row.iban,
    bankName: row.bank_name,
    instructions: row.instructions,
    isActive: row.is_active,
    displayOrder: row.display_order,
    swiftCode: row.payment_method_details?.swift_code ?? null,
    branchCode: row.payment_method_details?.branch_code ?? null,
    qrCodeUrl: row.payment_method_details?.qr_code_url ?? null,
  };
}

/** Unpaginated — used to populate the customer's method picker at checkout/payment submission, which needs every active method, not one page of them. */
export async function getPaymentMethods(
  supabase: SupabaseClient<Database>,
  options: { activeOnly?: boolean } = {},
): Promise<PaymentMethodDetail[]> {
  let query = supabase
    .from("payment_methods")
    .select("*, payment_method_details(swift_code, branch_code, qr_code_url)")
    .order("display_order");
  if (options.activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[getPaymentMethods] failed:", error);
    return [];
  }
  return (
    data as unknown as Parameters<typeof mapPaymentMethod>[0][]
  ).map(mapPaymentMethod);
}

export interface PaymentMethodListResult {
  items: PaymentMethodDetail[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Paginated — for the admin payment methods list page. */
export async function searchPaymentMethods(
  supabase: SupabaseClient<Database>,
  options: { page?: number; pageSize?: number } = {},
): Promise<PaymentMethodListResult> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;

  const { data, count, error } = await supabase
    .from("payment_methods")
    .select("*, payment_method_details(swift_code, branch_code, qr_code_url)", { count: "exact" })
    .order("display_order")
    .range(from, from + pageSize - 1);

  if (error || !data) {
    if (error) console.error("[searchPaymentMethods] failed:", error);
    return { items: [], totalCount: 0, page, pageSize, pageCount: 1 };
  }

  const totalCount = count ?? 0;
  return {
    items: (data as unknown as Parameters<typeof mapPaymentMethod>[0][]).map(mapPaymentMethod),
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getPaymentMethodById(
  supabase: SupabaseClient<Database>,
  id: number,
): Promise<PaymentMethodDetail | null> {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*, payment_method_details(swift_code, branch_code, qr_code_url)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return mapPaymentMethod(data as unknown as Parameters<typeof mapPaymentMethod>[0]);
}

// ---------------------------------------------------------------------------
export interface PaymentListItem {
  id: number;
  orderId: number;
  orderNumber: string;
  customerName: string;
  methodName: string | null;
  paymentType: PaymentTypeValue;
  amount: number;
  transactionReference: string | null;
  status: PaymentStatusValue;
  createdAt: string;
}

export interface PaymentSearchFilters {
  status?: PaymentStatusValue;
  page?: number;
  pageSize?: number;
}

export interface PaymentListResult {
  items: PaymentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function searchPayments(
  supabase: SupabaseClient<Database>,
  filters: PaymentSearchFilters = {},
): Promise<PaymentListResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("payments")
    .select(
      "id, order_id, payment_type, amount, transaction_reference, status, created_at, orders(order_number, customer_name), payment_methods(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error || !data) {
    if (error) console.error("[searchPayments] failed:", error);
    return { items: [], totalCount: 0, page, pageSize, pageCount: 1 };
  }

  const totalCount = count ?? 0;
  const rows = data as unknown as {
    id: number;
    order_id: number;
    payment_type: PaymentTypeValue;
    amount: number;
    transaction_reference: string | null;
    status: PaymentStatusValue;
    created_at: string;
    orders: { order_number: string; customer_name: string } | null;
    payment_methods: { name: string } | null;
  }[];

  return {
    items: rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      orderNumber: row.orders?.order_number ?? "—",
      customerName: row.orders?.customer_name ?? "—",
      methodName: row.payment_methods?.name ?? null,
      paymentType: row.payment_type,
      amount: row.amount,
      transactionReference: row.transaction_reference,
      status: row.status,
      createdAt: row.created_at,
    })),
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export interface PaymentDetail {
  id: number;
  orderId: number;
  orderNumber: string;
  customerName: string;
  methodName: string | null;
  paymentType: PaymentTypeValue;
  amount: number;
  transactionReference: string | null;
  screenshotPath: string;
  note: string | null;
  status: PaymentStatusValue;
  rejectionReason: string | null;
  rejectionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

function mapPaymentDetail(row: {
  id: number;
  order_id: number;
  payment_type: PaymentTypeValue;
  amount: number;
  transaction_reference: string | null;
  screenshot_path: string;
  note: string | null;
  status: PaymentStatusValue;
  rejection_reason: string | null;
  rejection_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  orders: { order_number: string; customer_name: string } | null;
  payment_methods: { name: string } | null;
}): PaymentDetail {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.orders?.order_number ?? "—",
    customerName: row.orders?.customer_name ?? "—",
    methodName: row.payment_methods?.name ?? null,
    paymentType: row.payment_type,
    amount: row.amount,
    transactionReference: row.transaction_reference,
    screenshotPath: row.screenshot_path,
    note: row.note,
    status: row.status,
    rejectionReason: row.rejection_reason,
    rejectionNote: row.rejection_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function getPaymentById(
  supabase: SupabaseClient<Database>,
  id: number,
): Promise<PaymentDetail | null> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, order_id, payment_type, amount, transaction_reference, screenshot_path, note, status, rejection_reason, rejection_note, reviewed_at, created_at, orders(order_number, customer_name), payment_methods(name)",
    )
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return mapPaymentDetail(data as unknown as Parameters<typeof mapPaymentDetail>[0]);
}

/** All payment attempts for one order (a rejected submission can be followed by a new one). */
export async function getPaymentsForOrder(
  supabase: SupabaseClient<Database>,
  orderId: number,
): Promise<PaymentDetail[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, order_id, payment_type, amount, transaction_reference, screenshot_path, note, status, rejection_reason, rejection_note, reviewed_at, created_at, orders(order_number, customer_name), payment_methods(name)",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("[getPaymentsForOrder] failed:", error);
    return [];
  }
  return (data as unknown as Parameters<typeof mapPaymentDetail>[0][]).map(mapPaymentDetail);
}
