"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { User, ShieldCheck, Package, Bell, Star } from "lucide-react";

const links = [
  { href: "/account", label: "Profile", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/reviews", label: "My Reviews", icon: Star },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/security", label: "Security", icon: ShieldCheck },
] as const;

export function AccountNav({ fullName }: { fullName: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="space-y-1">
      <p className="mb-3 truncate px-2 text-sm font-medium text-muted-foreground">
        {fullName}
      </p>
      {links.map((link) => {
        const active =
          link.href === "/account" ? pathname === link.href : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
      <div className="mt-2 border-t border-border pt-2">
        <SignOutButton className="px-2 font-normal text-muted-foreground hover:text-foreground" />
      </div>
    </nav>
  );
}
