import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * site_settings is a singleton row read by the root layout (dark mode
 * flag), the header, and the footer on every storefront page load.
 * Wrapped in React's cache() so those all dedupe to a single query per
 * request instead of three.
 */
export const getSiteSettings = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("site_settings").select("*").single();
  if (error) {
    console.error("[getSiteSettings] failed:", error);
    return null;
  }
  return data;
});

/** Only used if the site_settings row can't be read (it always exists after migrations). */
export const DEFAULT_STORE_NAME = "Atelier Jewelry";

/** The admin-configured store name (Admin → Settings), for headers, titles, invoices, etc. */
export async function getStoreName(): Promise<string> {
  const settings = await getSiteSettings();
  return settings?.store_name?.trim() || DEFAULT_STORE_NAME;
}

/**
 * Same as getStoreName, but with an explicit client — for code that runs
 * outside a request with cookies (emails sent from cron jobs), where
 * getSiteSettings' cookie-based client can't be created.
 */
export async function getStoreNameWith(supabase: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await supabase.from("site_settings").select("store_name").single();
  if (error) {
    console.error("[getStoreNameWith] failed:", error);
  }
  return data?.store_name?.trim() || DEFAULT_STORE_NAME;
}

/**
 * admin_settings is admin-only (RLS). This variant takes an explicit
 * client so it also works from `lib/notifications/events.ts`, which is
 * called from customer-triggered actions (order/payment) using the
 * service-role client — a customer's own session could never read this
 * table via RLS, so the caller here must be service-role, not cached
 * per-request the way the admin-page variant below is.
 */
export async function getAdminSettingsWith(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("admin_settings").select("*").single();
  if (error) {
    console.error("[getAdminSettingsWith] failed:", error);
    return null;
  }
  return data;
}

/** Session-scoped + cached — for admin pages only (never the public layout/header). */
export const getAdminSettings = cache(async () => {
  const supabase = await createServerSupabaseClient();
  return getAdminSettingsWith(supabase);
});
