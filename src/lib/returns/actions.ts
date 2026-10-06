"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { uploadReturnProofs, getReturnProofSignedUrls } from "@/lib/storage/return-proofs";
import { getOrderById } from "@/lib/orders/queries";
import { getReturnRequestById } from "@/lib/returns/queries";
import {
  notifyReturnRequested,
  notifyReturnApproved,
  notifyReturnRejected,
  notifyOrderStatusChanged,
} from "@/lib/notifications/events";
import {
  requestReturnRpc,
  reviewReturnRequestRpc,
  markReturnReceivedRpc,
  friendlyRequestReturnError,
} from "@/lib/returns/mutations";
import {
  requestReturnSchema,
  reviewReturnRequestSchema,
  type RequestReturnInput,
  type ReviewReturnRequestInput,
} from "@/lib/validations/orders";
import { ORDER_STATUS_LABELS } from "@/constants";
import { actionOk, actionError, type ActionResult } from "@/lib/action-result";

/**
 * Customer submits a return request (title + reason + proof photos) for an
 * order they own. Uses the customer's own session client for the storage
 * upload (so storage.objects RLS actually gates it to their own folder),
 * then the service-role client for request_return (which the RPC's grant
 * requires).
 */
export async function requestReturnAction(
  input: Omit<RequestReturnInput, "imageCount">,
  formData: FormData,
): Promise<ActionResult> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const parsed = requestReturnSchema.safeParse({ ...input, imageCount: files.length });
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const profile = await requireUser();
  const supabase = await createServerSupabaseClient();
  const order = await getOrderById(supabase, parsed.data.orderId);
  if (!order) return actionError("Order not found.");
  if (order.customerId !== profile.id) return actionError("You don't have access to this order.");
  if (!["delivered", "partial_completed", "completed"].includes(order.status)) {
    return actionError("This order isn't eligible for a return request.");
  }

  const uploadResult = await uploadReturnProofs(supabase, profile.id, order.id, files);
  if (!uploadResult.ok) return actionError(uploadResult.error);

  const admin = createAdminSupabaseClient();
  const result = await requestReturnRpc(admin, {
    orderId: order.id,
    customerId: profile.id,
    title: parsed.data.title,
    reason: parsed.data.reason,
    imagePaths: uploadResult.paths,
  });

  if (!result.ok) {
    return actionError(friendlyRequestReturnError(result.message));
  }

  await notifyReturnRequested(admin, {
    returnRequestId: result.request.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: profile.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    title: parsed.data.title,
  });

  revalidatePath(`/account/orders/${order.id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/returns");
  return actionOk(undefined);
}

/** Admin approve/reject. */
export async function reviewReturnRequestAction(input: ReviewReturnRequestInput): Promise<ActionResult> {
  const parsed = reviewReturnRequestSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const admin = await requireAdmin();
  const serviceClient = createAdminSupabaseClient();

  const result = await reviewReturnRequestRpc(serviceClient, {
    requestId: parsed.data.requestId,
    newStatus: parsed.data.decision,
    reviewerId: admin.id,
    adminReason: parsed.data.adminReason,
  });

  if (!result.ok) {
    if (result.message === "RETURN_REQUEST_ALREADY_REVIEWED") {
      return actionError("This return request has already been reviewed.");
    }
    return actionError("Could not review this return request. Please try again.");
  }

  await writeAuditLog({
    actorId: admin.id,
    action: parsed.data.decision === "approved" ? "return_request.approved" : "return_request.rejected",
    entityType: "return_requests",
    entityId: parsed.data.requestId,
    metadata: {
      order_id: result.request.order_id,
      admin_reason: parsed.data.adminReason ?? null,
    },
  });

  const order = await getOrderById(serviceClient, result.request.order_id);
  if (order) {
    if (parsed.data.decision === "approved") {
      await notifyReturnApproved(serviceClient, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        guestToken: order.guestAccessToken,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
      });
    } else {
      await notifyReturnRejected(serviceClient, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        guestToken: order.guestAccessToken,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        reason: parsed.data.adminReason ?? "Not specified",
      });
    }
  }

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${parsed.data.requestId}`);
  revalidatePath(`/admin/orders/${result.request.order_id}`);
  revalidatePath(`/account/orders/${result.request.order_id}`);
  return actionOk(undefined);
}

/** Admin confirms the physical parcel has been received back — the final step. */
export async function markReturnReceivedAction(orderId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const serviceClient = createAdminSupabaseClient();

  const order = await getOrderById(serviceClient, orderId);
  if (!order) return actionError("Order not found.");

  const result = await markReturnReceivedRpc(serviceClient, { orderId, adminId: admin.id });
  if (!result.ok) {
    if (result.message.startsWith("ORDER_NOT_AWAITING_RETURN")) {
      return actionError("This order isn't awaiting a return.");
    }
    return actionError("Could not mark this order as returned. Please try again.");
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "order.return_received",
    entityType: "orders",
    entityId: orderId,
  });

  await notifyOrderStatusChanged(serviceClient, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    guestToken: order.guestAccessToken,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    statusLabel: ORDER_STATUS_LABELS.returned,
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  return actionOk(undefined);
}

/** Short-lived signed URLs for return proof photos (never public URLs). */
export async function getReturnProofUrlsAction(
  returnRequestId: number,
): Promise<ActionResult<{ urls: string[] }>> {
  await requireUser();
  const supabase = await createServerSupabaseClient();
  const request = await getReturnRequestById(supabase, returnRequestId);
  if (!request) return actionError("Return request not found.");

  const urls = await getReturnProofSignedUrls(supabase, request.imagePaths);
  return actionOk({ urls });
}
