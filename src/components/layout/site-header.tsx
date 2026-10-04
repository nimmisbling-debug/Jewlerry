import Link from "next/link";
import type { Route } from "next";
import { User } from "lucide-react";
import { getCurrentProfile } from "@/lib/permissions";
import { getSiteSettings, DEFAULT_STORE_NAME } from "@/lib/settings/queries";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CartBadge } from "@/components/layout/cart-badge";
import { MobileNav } from "@/components/layout/mobile-nav";
import { StoreWordmark } from "@/components/layout/store-wordmark";
import { NotificationBell } from "@/components/layout/notification-bell";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQs" },
] as const;

export async function SiteHeader() {
  const [profile, settings] = await Promise.all([getCurrentProfile(), getSiteSettings()]);

  const accountHref: Route = profile ? (profile.role === "admin" ? "/admin" : "/account") : "/sign-in";
  const accountLabel = profile ? "My Account" : "Sign in";
  const storeName = settings?.store_name?.trim() || DEFAULT_STORE_NAME;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <MobileNav
            navLinks={NAV_LINKS.map((l) => ({ href: l.href, label: l.label }))}
            accountHref={accountHref}
            accountLabel={accountLabel}
            storeName={storeName}
          />
          <Link href="/" className="font-heading text-xl font-semibold tracking-wide">
            <StoreWordmark name={storeName} />
          </Link>
        </div>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <div className="hidden sm:block">
            <ThemeToggle
              persistForUser={!!profile}
              allowDark={settings?.dark_mode_enabled ?? true}
            />
          </div>
          <Link
            href={accountHref}
            className="inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
            aria-label={accountLabel}
          >
            <User className="size-5" />
          </Link>
          <NotificationBell />
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
