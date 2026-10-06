import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentTypeValue } from "@/types/database";
import type { PaymentMethodFormInput } from "@/lib/validations/admin";

export async function submitPaymentRpc(
  supabase: SupabaseClient<Database>,
  params: {
    orderId: number;
    /** Exactly one of customerId / guestAccessToken. */
    customerId: string | null;
    guestAccessToken?: string | null;
    paymentMethodId: number;
    paymentType: PaymentTypeValue;
    transactionReference: string | null;
    screenshotPath: string;
    note?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("submit_payment", {
    p_order_id: params.orderId,
    p_customer_id: params.customerId,
    p_payment_method_id: params.paymentMethodId,
    p_payment_type: params.paymentType,
    p_transaction_reference: params.transactionReference,
    p_screenshot_path: params.screenshotPath,
    p_note: params.note ?? null,
    p_guest_access_token: params.guestAccessToken ?? null,
  });
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, payment: data };
}

export async function reviewPaymentRpc(
  supabase: SupabaseClient<Database>,
  params: {
    paymentId: number;
    newStatus: "approved" | "rejected";
    reviewerId: string;
    rejectionReason?: string | null;
    rejectionNote?: string | null;
  },
) {
  const { data, error } = await supabase.rpc("review_payment", {
    p_payment_id: params.paymentId,
    p_new_status: params.newStatus,
    p_reviewer_id: params.reviewerId,
    p_rejection_reason: params.rejectionReason ?? null,
    p_rejection_note: params.rejectionNote ?? null,
  });
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, payment: data };
}

export function friendlySubmitPaymentError(message: string): string {
  if (message === "ORDER_NOT_FOUND") return "Order not found.";
  if (message.startsWith("ORDER_NOT_PAYABLE")) {
    return "This order can no longer accept a payment submission.";
  }
  if (message === "DELIVERY_FEE_NOT_AVAILABLE") {
    return "This order has no delivery fee, so please pay the full amount.";
  }
  return "Could not submit your payment. Please try again.";
}

// ---------------------------------------------------------------------------
// Payment methods (admin CRUD)
// ---------------------------------------------------------------------------
export async function createPaymentMethod(
  supabase: SupabaseClient<Database>,
  input: PaymentMethodFormInput,
) {
  const { data: method, error } = await supabase
    .from("payment_methods")
    .insert({
      type: input.type,
      name: input.name,
      account_holder_name: input.accountHolderName || null,
      account_number: input.accountNumber || null,
      iban: input.iban || null,
      bank_name: input.bankName || null,
      instructions: input.instructions || null,
      is_active: input.isActive,
      display_order: input.displayOrder,
    })
    .select()
    .single();

  if (error || !method) {
    return { ok: false as const, error: error?.message ?? "Failed to create payment method" };
  }

  if (input.swiftCode || input.branchCode) {
    await supabase.from("payment_method_details").insert({
      payment_method_id: method.id,
      swift_code: input.swiftCode || null,
      branch_code: input.branchCode || null,
    });
  }

  return { ok: true as const, method };
}

export async function updatePaymentMethod(
  supabase: SupabaseClient<Database>,
  id: number,
  input: PaymentMethodFormInput,
) {
  const { error } = await supabase
    .from("payment_methods")
    .update({
      type: input.type,
      name: input.name,
      account_holder_name: input.accountHolderName || null,
      account_number: input.accountNumber || null,
      iban: input.iban || null,
      bank_name: input.bankName || null,
      instructions: input.instructions || null,
      is_active: input.isActive,
      display_order: input.displayOrder,
    })
    .eq("id", id);

  if (error) return { ok: false as const, error: error.message };

  if (input.swiftCode || input.branchCode) {
    await supabase
      .from("payment_method_details")
      .upsert(
        { payment_method_id: id, swift_code: input.swiftCode || null, branch_code: input.branchCode || null },
        { onConflict: "payment_method_id" },
      );
  }

  return { ok: true as const };
}

export async function deletePaymentMethod(supabase: SupabaseClient<Database>, id: number) {
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
