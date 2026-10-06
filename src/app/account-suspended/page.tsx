import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata: Metadata = { title: "Account suspended" };

export default function AccountSuspendedPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Account suspended</CardTitle>
          <CardDescription>
            This account has been suspended and can no longer sign in or
            place orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, please reach out via our{" "}
            <a href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
              contact page
            </a>{" "}
            and we&apos;ll look into it.
          </p>
          <SignOutButton className="w-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
