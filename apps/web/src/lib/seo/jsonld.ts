import { absoluteUrl } from "./urls";
import { env } from "@/lib/env";
import type { SiteDto, VideoDto, ProductDto } from "@/lib/api/types";
import type { OfficeLike } from "./types-local";

type Node = Record<string, unknown>;

/** Organization + WebSite (site-wide, root layout). Only visible facts are emitted. */
export function siteGraph(site: SiteDto): Node[] {
  const origin = env.siteUrl;
  const sameAs = site.social.map((s) => s.url);
  const org: Node = {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: site.siteName,
    legalName: site.legalName ?? site.siteName,
    url: origin,
    logo: site.logoLight ? { "@type": "ImageObject", url: site.logoLight.url } : undefined,
    foundingDate: "2007",
    description: site.footer.blurb ?? undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    contactPoint: site.channels.filter((c) => c.type === "PHONE").map((c) => ({
      "@type": "ContactPoint", telephone: c.value, contactType: "sales", areaServed: "ET", availableLanguage: ["English"],
    })),
    subOrganization: [
      { "@type": "Organization", name: "Baraton Trade PLC", location: "Ethiopia" },
      { "@type": "Organization", name: "Baraton Trade LLC", location: "Florida, USA" },
    ],
  };
  const website: Node = {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: origin,
    name: site.siteName,
    inLanguage: site.locale,
    publisher: { "@id": `${origin}/#organization` },
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
  return [org, website];
}

export function localBusiness(office: OfficeLike, site: SiteDto): Node {
  return {
    "@type": "LocalBusiness",
    "@id": `${env.siteUrl}/#office-${office.id}`,
    name: office.name,
    parentOrganization: { "@id": `${env.siteUrl}/#organization` },
    address: { "@type": "PostalAddress", streetAddress: office.lines.slice(0, 2).join(", "), addressLocality: office.city, addressCountry: office.countryName, postOfficeBoxNumber: office.lines.find((l) => /P\.?O\.?\s?Box/i.test(l)) },
    telephone: site.channels.find((c) => c.type === "PHONE")?.value,
    email: site.channels.find((c) => c.type === "EMAIL")?.value,
    ...(office.latitude && office.longitude ? { geo: { "@type": "GeoCoordinates", latitude: office.latitude, longitude: office.longitude } } : {}),
  };
}

export function breadcrumbList(items: { label: string; href?: string }[]): Node {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      ...(it.href ? { item: absoluteUrl(it.href) } : {}),
    })),
  };
}

export function productNode(p: ProductDto): Node {
  return {
    "@type": "Product",
    name: p.title,
    description: p.shortDescription,
    image: p.image ? [p.image.url] : undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    category: p.category?.name,
    countryOfOrigin: p.country?.name ?? undefined,
    additionalProperty: p.specs.map((s) => ({ "@type": "PropertyValue", name: s.label, value: s.unit ? `${s.value} ${s.unit}` : s.value })),
    url: absoluteUrl(`/products/${p.slug}`),
  };
}

export function videoObject(v: VideoDto, pageUrl: string): Node | null {
  const thumb = v.thumbnailUrl ?? v.posterUrl;
  if (v.sourceType === "YOUTUBE" && !v.youtubeId) return null;
  if (v.sourceType === "UPLOAD" && !v.mediaUrl) return null;
  return {
    "@type": "VideoObject",
    name: v.title,
    description: v.description ?? v.title,
    thumbnailUrl: thumb ? [thumb] : undefined,
    uploadDate: v.updatedAt,
    contentUrl: v.sourceType === "UPLOAD" && v.mediaUrl ? absoluteUrl(v.mediaUrl) : undefined,
    embedUrl: v.sourceType === "YOUTUBE" && v.youtubeId ? `https://www.youtube-nocookie.com/embed/${v.youtubeId}` : undefined,
    duration: v.durationSeconds ? `PT${v.durationSeconds}S` : undefined,
    url: pageUrl,
  };
}

export function faqPage(items: { question: string; answer: string }[]): Node {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
  };
}
