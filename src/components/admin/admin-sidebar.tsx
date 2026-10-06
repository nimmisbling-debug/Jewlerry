"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  ShoppingCart,
  CreditCard,
  Undo2,
  Landmark,
  Settings,
  Users,
  Star,
  Bell,
  Image as ImageIcon,
  Mail,
  HelpCircle,
  ScrollText,
} from "lucide-react";
import { SignOutButton } from "@/components/layout/sign-out-button";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/tags", label: "Tags", icon: Tags },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/returns", label: "Returns", icon: Undo2 },
  { href: "/admin/payment-methods", label: "Payment Methods", icon: Landmark },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/contact", label: "Contact Messages", icon: Mail },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminSidebar({ adminName, storeName }: { adminName: string; storeName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col border-border bg-sidebar text-sidebar-foreground md:h-screen md:w-60 md:border-r">
      <div className="border-b border-sidebar-border px-5 py-5">
        <p className="font-heading text-lg font-semibold">{storeName} Admin</p>
        <p className="truncate text-sm text-sidebar-foreground/70">{adminName}</p>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const active =
            link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <SignOutButton className="text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground" />
      </div>
    </aside>
  );
}
