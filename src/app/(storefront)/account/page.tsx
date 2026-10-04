import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/permissions";
import { getStoreName } from "@/lib/settings/queries";
import { UpdateProfileForm } from "@/components/storefront/update-profile-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DeleteAccountDialog } from "@/components/storefront/delete-account-dialog";

export const metadata: Metadata = { title: "My Profile" };

export default async function AccountProfilePage() {
  const [profile, storeName] = await Promise.all([requireUser(), getStoreName()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>{profile.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdateProfileForm
            defaultValues={{
              fullName: profile.full_name,
              username: profile.username,
              phone: profile.phone ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how {storeName} looks on your devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle persistForUser />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Deleting your account is permanent and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
