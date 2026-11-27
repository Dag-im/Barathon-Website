import type { MetadataRoute } from "next";
import { getSite } from "@/lib/api/public";
import { env } from "@/lib/env";

/** robots.txt: forced rules first, CMS noindex respected, always points at the sitemap (backend 6.2.6). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSite().catch(() => null);
  if (!env.enableIndexing || site?.seoDefaults.siteNoindex) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/search"] },
    sitemap: [`${env.siteUrl}/sitemap.xml`, `${env.siteUrl}/video-sitemap.xml`],
  };
}
