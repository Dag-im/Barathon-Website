import type { Metadata } from "next";
import { absoluteUrl } from "./urls";

/**
 * Metadata for list and filtered pages (plan 5.8). Filtered URLs are noindex,follow
 * with the canonical pointing at the unfiltered base; page N>1 is self-canonical.
 */
export function listMetadata({
  title, description, path, page = 1, filtered = false,
}: { title: string; description?: string | null; path: string; page?: number; filtered?: boolean }): Metadata {
  const fullTitle = page > 1 ? `${title} - Page ${page}` : title;
  const canonical = filtered ? absoluteUrl(path) : page > 1 ? absoluteUrl(`${path}?page=${page}`) : absoluteUrl(path);
  return {
    title: { absolute: `${fullTitle} | Baraton Group Co.` },
    description: description ?? undefined,
    alternates: { canonical },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title: fullTitle, description: description ?? undefined, url: canonical, siteName: "Baraton Group Co.", type: "website" },
  };
}
