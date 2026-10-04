import Link from "next/link";
import { getSiteSettings, DEFAULT_STORE_NAME } from "@/lib/settings/queries";

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const storeName = settings?.store_name?.trim() || DEFAULT_STORE_NAME;
  const socialLinks = (settings?.social_links ?? []) as { label: string; url: string }[];

  return (
    <footer className="mt-auto border-t border-border/70 bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="font-heading text-lg font-semibold">
            {storeName}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Fine jewelry, thoughtfully made.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Shop</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/products" className="hover:text-foreground">
                All products
              </Link>
            </li>
            <li>
              <Link href="/products?tag=sale" className="hover:text-foreground">
                Sale
              </Link>
            </li>
            <li>
              <Link href="/products?tag=new" className="hover:text-foreground">
                New arrivals
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Support</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/contact" className="hover:text-foreground">
                Contact us
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-foreground">
                FAQs
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Get in touch</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {settings?.store_email && <li>{settings.store_email}</li>}
            {settings?.store_phone && <li>{settings.store_phone}</li>}
            {settings?.address && <li>{settings.address}</li>}
            {socialLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {storeName}. All rights
        reserved.
      </div>
    </footer>
  );
}
