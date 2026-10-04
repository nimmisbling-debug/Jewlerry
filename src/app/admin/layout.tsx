import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getStoreName } from "@/lib/settings/queries";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  // Forced first-login password change (bootstrap admin, or any admin an
  // existing admin resets). Redirects to a standalone route outside this
  // layout so there's no redirect loop.
  if (profile.must_change_password) {
    redirect("/force-password-change");
  }

  const storeName = await getStoreName();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar adminName={profile.full_name || profile.username} storeName={storeName} />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="mb-4 flex justify-end">
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
