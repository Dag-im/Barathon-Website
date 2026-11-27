import type { Metadata } from "next";
import type { SeoDto } from "@/lib/api/types";
import { env } from "@/lib/env";

/** Maps the API SeoDto (already templated and absolute) onto Next.js Metadata. */
export function toMetadata(seo: SeoDto): Metadata {
  const indexable = !seo.robots.includes("noindex") && env.enableIndexing;
  const og = seo.openGraph;
  const images = og.image ? [{ url: og.image.url, width: og.image.width ?? 1200, height: og.image.height ?? 630, alt: og.image.alt ?? og.title }] : undefined;
  return {
    title: { absolute: seo.title },
    description: seo.description ?? undefined,
    alternates: { canonical: seo.canonical },
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: seo.robots.includes("follow") },
    openGraph: {
      title: og.title,
      description: og.description ?? undefined,
      url: og.url,
      siteName: og.siteName,
      locale: og.locale,
      type: og.type === "product" ? "website" : og.type,
      images,
    },
    twitter: {
      card: seo.twitter.card,
      title: seo.twitter.title,
      description: seo.twitter.description ?? undefined,
      images: og.image ? [og.image.url] : undefined,
    },
  };
}

/** Metadata for private surfaces: never indexed. */
export const noindexMetadata: Metadata = {
  title: { absolute: "Admin | Baraton Group Co." },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};
