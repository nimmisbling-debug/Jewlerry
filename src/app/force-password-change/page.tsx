import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/storefront/change-password-form";
import { requireUser } from "@/lib/permissions";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * Standalone route (deliberately NOT nested under /admin or /account) so
 * admin/layout.tsx can redirect here when must_change_password is true
 * without looping: this page isn't wrapped by that layout, so its own
 * redirect-if-already-changed check is the only gate in play.
 */
export default async function ForcePasswordChangePage() {
  const profile = await requireUser();

  if (!profile.must_change_password) {
    redirect(profile.role === "admin" ? "/admin" : "/account");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Set a new password</CardTitle>
          <CardDescription>
            For security, you need to change your password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm redirectTo={profile.role === "admin" ? "/admin" : "/account"} />
          <SignOutButton className="mt-3 justify-center text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}
