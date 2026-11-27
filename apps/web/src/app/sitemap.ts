import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/api/public";
import { env } from "@/lib/env";

/** sitemap.xml from the API composition (backend 6.2.5). Excludes admin, search and noindex entities. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await getSitemapEntries().catch(() => ({ data: [] }));
  if (!env.enableIndexing) return [];
  return data.map((e) => ({
    url: e.loc,
    lastModified: e.lastmod,
    changeFrequency: e.changefreq,
    priority: e.priority,
    images: e.images,
  }));
}
