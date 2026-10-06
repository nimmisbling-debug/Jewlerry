import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAdminSettingsWith } from "@/lib/settings/queries";
import { changeOrderStatusRpc } from "@/lib/orders/mutations";
import { notifyOrderStatusChanged } from "@/lib/notifications/events";
import { writeAuditLog } from "@/lib/audit";
import { ORDER_STATUS_LABELS } from "@/constants";

/**
 * Cancels `unconfirmed` orders that have sat with no payment submitted for
 * longer than `admin_settings.order_auto_cancel_unconfirmed_hours` — the
 * setting has existed (and been admin-configurable, see Phase 11's
 * Automation tab) since Phase 2's schema, but nothing ever actually
 * enforced it until now. Meant to be invoked on a schedule (Vercel Cron,
 * or any external scheduler hitting this URL) — see README's deployment
 * section for the `vercel.json` entry. Gated on `CRON_SECRET` so this
 * can't be triggered by an arbitrary request; returns 404 rather than 401
 * when unset so the endpoint's existence isn't revealed on a
 * misconfigured deployment.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  if (!env.CRON_SECRET) {
    return new Response("Not found", { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const settings = await getAdminSettingsWith(admin);
  const hours = settings?.order_auto_cancel_unconfirmed_hours ?? 48;
  const cutoffIso = new Date(Date.now() - hours * 3_600_000).toISOString();
  const reason = `Automatically cancelled — no payment submitted within ${hours} hours.`;

  const { data: staleOrders, error } = await admin
    .from("orders")
    .select("id, order_number, customer_id, guest_access_token, customer_name, customer_email")
    .eq("status", "unconfirmed")
    .lt("created_at", cutoffIso);

  if (error) {
    console.error("[cron:auto-cancel-orders] failed to query stale orders:", error);
    return Response.json({ error: "Failed to query orders" }, { status: 500 });
  }

  let cancelledCount = 0;
  for (const order of staleOrders ?? []) {
    await admin.from("orders").update({ cancelled_reason: reason }).eq("id", order.id);

    const result = await changeOrderStatusRpc(admin, {
      orderId: order.id,
      newStatus: "cancelled",
      changedBy: null,
      reason,
    });
    if (!result.ok) {
      console.error("[cron:auto-cancel-orders] failed to cancel order", order.id, result.message);
      continue;
    }

    cancelledCount++;
    await notifyOrderStatusChanged(admin, {
      orderId: order.id,
      orderNumber: order.order_number,
      customerId: order.customer_id,
      guestToken: order.guest_access_token,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      statusLabel: ORDER_STATUS_LABELS.cancelled,
    });
    await writeAuditLog({
      actorId: null,
      action: "order.auto_cancelled",
      entityType: "orders",
      entityId: order.id,
      metadata: { reason },
    });
  }

  return Response.json({ checked: staleOrders?.length ?? 0, cancelled: cancelledCount });
}
