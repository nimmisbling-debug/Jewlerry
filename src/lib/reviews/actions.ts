"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createReview, updateReview, deleteReview, setReviewHidden } from "@/lib/reviews/mutations";
import { getOrderById } from "@/lib/orders/queries";
import { changeOrderStatusRpc } from "@/lib/orders/mutations";
import { notifyOrderStatusChanged } from "@/lib/notifications/events";
import { ORDER_STATUS_LABELS } from "@/constants";
import { writeAuditLog } from "@/lib/audit";
import { reviewFormSchema, updateReviewSchema, type ReviewFormInput, type UpdateReviewInput } from "@/lib/validations/reviews";
import { actionOk, actionError, type ActionResult } from "@/lib/action-result";

async function revalidateProductBySlug(productId: number) {
  const supabase = await createServerSupabaseClient();
  // No direct id->slug lookup helper exists; product detail pages are
  // revalidated by path, so look the slug up the one place it's indexed.
  const { data } = await supabase.from("products").select("slug").eq("id", productId).maybeSingle();
  if (data?.slug) revalidatePath(`/products/${data.slug}`);
}

export async function submitReviewAction(input: ReviewFormInput): Promise<ActionResult> {
  const parsed = reviewFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const profile = await requireUser();
  const supabase = await createServerSupabaseClient();
  const result = await createReview(supabase, {
    productId: parsed.data.productId,
    orderId: parsed.data.orderId,
    customerId: profile.id,
    rating: parsed.data.rating,
    title: parsed.data.title,
    comment: parsed.data.comment,
  });
  if (!result.ok) return actionError(result.error);

  // Rule: an order only ever reaches "completed" once the customer has
  // reviewed every product in it — never as a bare admin status edit (see
  // the `delivered`/`partial_completed` entries in transitions.ts's
  // ADMIN_EXCLUDED). A review can only be submitted for a delivered/
  // partial_completed/completed order in the first place
  // (validate_review_eligibility, migration 0019), so "delivered" or
  // "partial_completed" here means this review moves that progress along.
  // An order with only one product skips partial_completed entirely and
  // goes straight from delivered to completed, same as before.
  const order = await getOrderById(supabase, parsed.data.orderId);
  if (order && (order.status === "delivered" || order.status === "partial_completed")) {
    const totalProducts = new Set(
      order.items.map((item) => item.productId).filter((id): id is number => id !== null),
    ).size;
    const { count: reviewedCount } = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id)
      .eq("customer_id", profile.id);

    const newStatus = (reviewedCount ?? 0) >= totalProducts ? "completed" : "partial_completed";

    if (newStatus !== order.status) {
      const admin = createAdminSupabaseClient();
      const statusResult = await changeOrderStatusRpc(admin, {
        orderId: order.id,
        newStatus,
        changedBy: profile.id,
        reason:
          newStatus === "completed"
            ? "Automatically completed — every product in the order has been reviewed"
            : "Automatically marked partially completed — some products have been reviewed",
      });
      if (statusResult.ok) {
        await notifyOrderStatusChanged(admin, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          guestToken: order.guestAccessToken,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          statusLabel: ORDER_STATUS_LABELS[newStatus],
        });
        await writeAuditLog({
          actorId: profile.id,
          action: newStatus === "completed" ? "order.auto_completed_by_review" : "order.auto_partial_completed_by_review",
          entityType: "orders",
          entityId: order.id,
        });
        revalidatePath("/admin/orders");
        revalidatePath(`/admin/orders/${order.id}`);
      }
    }
  }

  await revalidateProductBySlug(parsed.data.productId);
  revalidatePath(`/account/orders/${parsed.data.orderId}`);
  revalidatePath("/account/reviews");
  return actionOk(undefined);
}

export async function updateReviewAction(input: UpdateReviewInput): Promise<ActionResult> {
  const parsed = updateReviewSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  await requireUser();
  const supabase = await createServerSupabaseClient();
  const result = await updateReview(supabase, parsed.data.reviewId, {
    rating: parsed.data.rating,
    title: parsed.data.title,
    comment: parsed.data.comment,
  });
  if (!result.ok) return actionError(result.error);

  revalidatePath("/account/reviews");
  return actionOk(undefined);
}

export async function deleteReviewAction(reviewId: number): Promise<ActionResult> {
  await requireUser();
  const supabase = await createServerSupabaseClient();
  const result = await deleteReview(supabase, reviewId);
  if (!result.ok) return actionError(result.error);

  revalidatePath("/account/reviews");
  return actionOk(undefined);
}

export async function toggleReviewHiddenAction(reviewId: number, isHidden: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const result = await setReviewHidden(supabase, reviewId, isHidden);
  if (!result.ok) return actionError(result.error);

  await writeAuditLog({
    actorId: admin.id,
    action: isHidden ? "review.hidden" : "review.unhidden",
    entityType: "reviews",
    entityId: reviewId,
  });

  revalidatePath("/admin/reviews");
  return actionOk(undefined);
}
