import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { getSiteSettings, getStoreName } from "@/lib/settings/queries";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const storeName = await getStoreName();
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    title: {
      default: storeName,
      template: `%s | ${storeName}`,
    },
    description:
      "Fine jewelry, thoughtfully made. Shop rings, necklaces, earrings and bracelets.",
    openGraph: {
      type: "website",
      siteName: storeName,
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getSiteSettings();
  // Admin can disable dark mode site-wide; when off, every visitor (signed
  // in or not) is forced to light regardless of their own OS/profile
  // preference — but this never overwrites their stored preference, only
  // the forcedTheme prop, so it reverts automatically if re-enabled.
  const forcedTheme = settings?.dark_mode_enabled === false ? "light" : undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders forcedTheme={forcedTheme}>{children}</AppProviders>
      </body>
    </html>
  );
}
