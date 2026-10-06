import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationTypeValue } from "@/types/database";

/**
 * All writers here take a service-role client — system-triggered
 * notifications (order/payment events) are never gated by the acting
 * user's own RLS, since e.g. a customer's own session can't write a
 * notification addressed to the admin who needs to review their payment.
 */
export async function createNotification(
  supabase: SupabaseClient<Database>,
  params: { userId: string | null; title: string; message: string; type: NotificationTypeValue },
): Promise<void> {
  // Guest orders have no account to notify in-app; they get email only.
  if (!params.userId) return;
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
  });
  if (error) console.error("[createNotification] failed:", error);
}

export async function createNotificationsForUsers(
  supabase: SupabaseClient<Database>,
  userIds: string[],
  params: { title: string; message: string; type: NotificationTypeValue },
): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase.from("notifications").insert(
    userIds.map((userId) => ({
      user_id: userId,
      title: params.title,
      message: params.message,
      type: params.type,
    })),
  );
  if (error) console.error("[createNotificationsForUsers] failed:", error);
}

/** Every admin — used for system alerts (new order, new payment to review) that aren't tied to one specific admin. */
export async function getAdminRecipients(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; email: string }[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "admin")
    .is("deleted_at", null);
  if (error) {
    console.error("[getAdminRecipients] failed:", error);
    return [];
  }
  return data;
}

export async function markNotificationRead(
  supabase: SupabaseClient<Database>,
  id: number,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    console.error("[markNotificationRead] failed:", error);
    return false;
  }
  return true;
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) {
    console.error("[markAllNotificationsRead] failed:", error);
    return false;
  }
  return true;
}
