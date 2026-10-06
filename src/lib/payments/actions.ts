"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { uploadPaymentProof, getPaymentProofSignedUrl } from "@/lib/storage/payment-proofs";
import { getOrderById, getOrderByGuestToken } from "@/lib/orders/queries";
import { getPaymentById } from "@/lib/payments/queries";
import {
  notifyPaymentSubmitted,
  notifyPaymentApproved,
  notifyPaymentRejected,
} from "@/lib/notifications/events";
import {
  submitPaymentRpc,
  reviewPaymentRpc,
  friendlySubmitPaymentError,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from "@/lib/payments/mutations";
import {
  submitPaymentSchema,
  reviewPaymentSchema,
  type SubmitPaymentInput,
  type ReviewPaymentInput,
} from "@/lib/validations/orders";
import {
  paymentMethodFormSchema,
  type PaymentMethodFormInput,
} from "@/lib/validations/admin";
import { actionOk, actionError, type ActionResult } from "@/lib/action-result";

/**
 * Customer submits payment proof for an order they own. Uses the
 * customer's own session client for the storage upload (so
 * storage.objects RLS actually gates it to their own folder), then the
 * service-role client for submit_payment (which the RPC's grant requires).
 *
 * Guests (input.guestToken) have no session: the token is checked against
 * the order, and the proof is uploaded with the service-role client into
 * the bucket's "guest/" folder (still private — only admins can read it).
 */
export async function submitPaymentAction(
  input: SubmitPaymentInput,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submitPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return actionError("Please attach a payment screenshot.");

  const admin = createAdminSupabaseClient();
  const guestToken = parsed.data.guestToken ?? null;
  let customerId: string | null = null;
  // Who uploads the proof, and into which top-level folder (see storage RLS).
  let uploadClient = admin;
  let uploadFolder = "guest";
  let order;

  if (guestToken) {
    order = await getOrderByGuestToken(admin, guestToken);
    if (!order || order.id !== parsed.data.orderId) return actionError("Order not found.");
  } else {
    const profile = await requireUser();
    customerId = profile.id;
    const supabase = await createServerSupabaseClient();
    uploadClient = supabase;
    uploadFolder = profile.id;
    order = await getOrderById(supabase, parsed.data.orderId);
    if (!order) return actionError("Order not found.");
    if (order.customerId !== profile.id) return actionError("You don't have access to this order.");
  }

  if (!["unconfirmed", "payment_pending"].includes(order.status)) {
    return actionError("This order can no longer accept a payment submission.");
  }

  const uploadResult = await uploadPaymentProof(uploadClient, uploadFolder, order.id, file);
  if (!uploadResult.ok) return actionError(uploadResult.error);

  const result = await submitPaymentRpc(admin, {
    orderId: parsed.data.orderId,
    customerId,
    guestAccessToken: guestToken,
    paymentMethodId: parsed.data.paymentMethodId,
    paymentType: parsed.data.paymentType,
    transactionReference: parsed.data.transactionReference || null,
    screenshotPath: uploadResult.path,
    note: parsed.data.note,
  });

  if (!result.ok) {
    return actionError(friendlySubmitPaymentError(result.message));
  }

  await notifyPaymentSubmitted(admin, {
    paymentId: result.payment.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId,
    guestToken,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    amount: result.payment.amount,
    currencyCode: order.currencyCode,
  });

  revalidatePath(guestToken ? `/order/${guestToken}` : `/account/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/payments");
  return actionOk(undefined);
}

/** Admin approve/reject. */
export async function reviewPaymentAction(input: ReviewPaymentInput): Promise<ActionResult> {
  const parsed = reviewPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const admin = await requireAdmin();
  const serviceClient = createAdminSupabaseClient();

  const result = await reviewPaymentRpc(serviceClient, {
    paymentId: parsed.data.paymentId,
    newStatus: parsed.data.decision,
    reviewerId: admin.id,
    rejectionReason: parsed.data.rejectionReason,
    rejectionNote: parsed.data.rejectionNote,
  });

  if (!result.ok) {
    if (result.message === "PAYMENT_ALREADY_REVIEWED") {
      return actionError("This payment has already been reviewed.");
    }
    return actionError("Could not review this payment. Please try again.");
  }

  await writeAuditLog({
    actorId: admin.id,
    action: parsed.data.decision === "approved" ? "payment.approved" : "payment.rejected",
    entityType: "payments",
    entityId: parsed.data.paymentId,
    metadata: {
      order_id: result.payment.order_id,
      rejection_reason: parsed.data.rejectionReason ?? null,
    },
  });

  const order = await getOrderById(serviceClient, result.payment.order_id);
  if (order) {
    if (parsed.data.decision === "approved") {
      await notifyPaymentApproved(serviceClient, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        guestToken: order.guestAccessToken,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        amount: result.payment.amount,
        currencyCode: order.currencyCode,
        dueOnDelivery: result.payment.payment_type === "delivery_fee" ? order.balanceDue : 0,
      });
    } else {
      await notifyPaymentRejected(serviceClient, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        guestToken: order.guestAccessToken,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        reason: parsed.data.rejectionReason ?? "Not specified",
        note: parsed.data.rejectionNote,
      });
    }
  }

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${parsed.data.paymentId}`);
  revalidatePath(`/admin/orders/${result.payment.order_id}`);
  revalidatePath(`/account/orders/${result.payment.order_id}`);
  return actionOk(undefined);
}

/** Short-lived signed URL for the admin payment-review screen (never a public URL). */
export async function getPaymentScreenshotUrlAction(
  paymentId: number,
): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const payment = await getPaymentById(supabase, paymentId);
  if (!payment) return actionError("Payment not found.");

  const url = await getPaymentProofSignedUrl(supabase, payment.screenshotPath);
  if (!url) return actionError("Could not load the payment screenshot.");
  return actionOk({ url });
}

// ---------------------------------------------------------------------------
// Payment methods (admin)
// ---------------------------------------------------------------------------
export async function createPaymentMethodAction(
  input: PaymentMethodFormInput,
): Promise<ActionResult> {
  const parsed = paymentMethodFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const admin = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const result = await createPaymentMethod(supabase, parsed.data);
  if (!result.ok) return actionError(result.error);

  await writeAuditLog({
    actorId: admin.id,
    action: "payment_method.created",
    entityType: "payment_methods",
    entityId: result.method.id,
    metadata: { name: result.method.name },
  });

  revalidatePath("/admin/payment-methods");
  return actionOk(undefined);
}

export async function updatePaymentMethodAction(
  id: number,
  input: PaymentMethodFormInput,
): Promise<ActionResult> {
  const parsed = paymentMethodFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const admin = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const result = await updatePaymentMethod(supabase, id, parsed.data);
  if (!result.ok) return actionError(result.error);

  await writeAuditLog({
    actorId: admin.id,
    action: "payment_method.updated",
    entityType: "payment_methods",
    entityId: id,
  });

  revalidatePath("/admin/payment-methods");
  return actionOk(undefined);
}

export async function deletePaymentMethodAction(id: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const result = await deletePaymentMethod(supabase, id);
  if (!result.ok) return actionError(result.error);

  await writeAuditLog({
    actorId: admin.id,
    action: "payment_method.deleted",
    entityType: "payment_methods",
    entityId: id,
  });

  revalidatePath("/admin/payment-methods");
  return actionOk(undefined);
}
