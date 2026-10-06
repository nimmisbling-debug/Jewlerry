import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Full sign-out: ends the Supabase session, deletes every cookie this site
 * set, and asks the browser (Clear-Site-Data) to wipe this origin's
 * cookies, localStorage/sessionStorage/IndexedDB and HTTP cache — so no
 * cart, theme or session data is left behind on a shared device.
 * SignOutButton also clears client storage itself first, for browsers that
 * don't support Clear-Site-Data.
 *
 * POST-only and same-origin-only, so another site can't sign a visitor out
 * with a link or a cross-site form.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    cookieStore.delete(cookie.name);
  }

  // 303: the browser follows the redirect with a GET.
  const response = NextResponse.redirect(new URL("/sign-in", request.url), 303);
  response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return response;
}
