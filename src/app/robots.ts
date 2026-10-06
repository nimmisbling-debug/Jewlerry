import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Every account/admin/auth/API route requires a signed-in session
      // anyway (RLS + requireUser/requireAdmin), so a crawler could never
      // usefully index them — excluding them here just avoids wasted
      // crawl budget and keeps them out of search results as a courtesy.
      disallow: ["/account", "/admin", "/api", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/checkout", "/cart", "/order"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
