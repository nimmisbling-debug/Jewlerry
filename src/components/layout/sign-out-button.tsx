"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { cn } from "@/lib/utils";

/**
 * Signs out via POST /auth/sign-out (session + cookies + Clear-Site-Data).
 * Before the request goes out it also wipes this site's browser storage
 * directly — the cart lives in localStorage — as a fallback for browsers
 * that ignore Clear-Site-Data. A native form post (not fetch) so the
 * server's redirect lands the browser on /sign-in with a fresh page.
 */
export function SignOutButton({ className }: { className?: string }) {
  function clearClientData() {
    useCartStore.getState().clear();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage can be unavailable (private mode / blocked); the server
      // response still clears it where the browser supports that.
    }
  }

  return (
    <form method="post" action="/auth/sign-out" onSubmit={clearClientData}>
      <Button type="submit" variant="ghost" className={cn("w-full justify-start", className)}>
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </Button>
    </form>
  );
}
