/**
 * DEV-ONLY mock seed. Built from docs/source/*.json and ui-strings.txt.
 * Only used when NEXT_PUBLIC_USE_MOCKS=1 outside production. Images are local
 * placeholders because the Cloudinary originals are not part of the new system.
 * Editors must review the proposed categories and the unnamed featured videos.
 */
import { marked } from "marked";
import { parseYoutube } from "@/lib/utils/youtube";
import productsJson from "./source/product.json";
import companiesJson from "./source/company.json";
import servicesJson from "./source/service.json";
import type { MediaDto } from "@/lib/api/types";

export const nowIso = () => new Date().toISOString();

export function media(url: string, alt: string | null, width = 1200, height = 900, kind: MediaDto["kind"] = "IMAGE"): MediaDto {
  return {
    id: `m-${url.replace(/[^a-z0-9]/gi, "").slice(-18)}`,
    kind, url, alt, caption: null, width, height, blurhash: null, dominantColor: null, lqip: null, focal: null,
    variants: [], srcset: { webp: url, avif: null }, mimeType: url.endsWith(".svg") ? "image/svg+xml" : "image/png", sizeBytes: 0,
  };
}

export const PH = {
  product: (alt: string) => media("/placeholders/product.svg", alt, 1200, 900),
  logo: (alt: string) => media("/placeholders/logo.svg", alt, 900, 600),
  generic: (alt: string) => media("/placeholders/generic.svg", alt, 1200, 900),
};

const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** Country normalisation table (backend plan 3.13.4). */
export function normaliseCountry(raw: string | null | undefined): { code: string | null; name: string | null; city: string | null } {
  if (!raw) return { code: null, name: null, city: null };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const name = parts[parts.length - 1] ?? raw.trim();
  const city = parts.length > 1 ? parts[0]! : null;
  const canonical = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const codes: Record<string, string> = { Japan: "JP", France: "FR", Sweden: "SE", Italy: "IT", Germany: "DE", Ethiopia: "ET", "United States": "US", USA: "US" };
  return { code: codes[canonical] ?? null, name: canonical, city };
}

/** Light markdown to HTML with heading shift (h1 is reserved for the page title). */
export function mdToHtml(md: string): string {
  const cleaned = md.replace(/\r\n/g, "\n").replace(/^#{4,6}\s*#{4,6}\s*$/gm, "").replace(/\n{3,}/g, "\n\n");
  const html = marked.parse(cleaned, { async: false, gfm: true }) as string;
  return html.replace(/<(\/?)h1(\s|>)/g, "<$1h2$2").replace(/<(\/?)h2(\s|>)/g, "<$1h3$2").replace(/<(\/?)h3(\s|>)/g, "<$1h4$2");
}

export function youtubeFix(raw: string | null | undefined) {
  return parseYoutube(raw ?? null);
}

/* ---------- admin-shaped records (store rows) ---------- */
export interface Row { id: string; status: string; sortOrder: number; version: number; createdAt: string; updatedAt: string; deletedAt: string | null; [k: string]: unknown }

const base = (id: string, sortOrder: number, status: string = "PUBLISHED"): Row => ({
  id, status, sortOrder, version: 1, createdAt: "2025-03-30T07:40:35.452Z", updatedAt: "2025-03-30T07:40:35.452Z", deletedAt: null,
});

export function productRows(): Row[] {
  const categoryFor = (title: string): string => {
    const t = title.toLowerCase();
    if (t.includes("air compressor")) return "compressed-air";
    if (t.includes("crusher")) return "crushing";
    if (t.includes("carmix")) return "concrete-mixing";
    return "rock-drilling";
  };
  return (productsJson as { _id: string; title: string; shortDescription: string; image: string; country: string; content: string; createdAt: string }[]).map((p, i) => {
    const slug = slugify(p.title.replace(/\s+/g, " "));
    const country = normaliseCountry(p.country);
    return {
      ...base(`prod-${slug}`, i + 1),
      slug, title: p.title.trim(), shortDescription: p.shortDescription.replace(/\s+/g, " ").trim(),
      contentHtml: mdToHtml(p.content ?? ""), country, categorySlug: categoryFor(p.title),
      brandSlug: brandSlugForProduct(p.title), isFeatured: i < 5, features: [],
      specs: [], documents: [], sourceCloudinary: p.image,
      createdAtLegacy: p.createdAt,
    };
  });
}

function brandSlugForProduct(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("furukawa")) return "furukawa-rock-drill-co";
  if (t.includes("air compressor")) return "airman";
  if (t.includes("montabert")) return "montabert";
  if (t.includes("monark")) return "monark";
  if (t.includes("carmix")) return "carmix";
  if (t.includes("elsasser")) return "elsasser";
  if (t.includes("walter")) return "walter-geratebou";
  if (t.includes("nakayama")) return "nakayama";
  return null;
}

export const CATEGORY_NAMES: Record<string, string> = {
  "rock-drilling": "Rock drilling",
  "compressed-air": "Compressed air",
  crushing: "Crushing",
  "concrete-mixing": "Concrete mixing",
};

export function brandRows(): Row[] {
  const out: Row[] = [];
  (companiesJson as { _id: string; logo_image: string; company_name: string; company_short_discription: string; company_youtubeLink: string; company_description: string; company_country: string }[]).forEach((c, i) => {
    const name = c.company_name.replace(/\s+/g, " ").trim();
    const slug = brandSlugForName(name);
    const country = normaliseCountry(c.company_country);
    out.push({
      ...base(`brand-${slug}`, i + 1),
      slug, name, shortDescription: c.company_short_discription.replace(/\s+/g, " ").trim(),
      descriptionHtml: mdToHtml(c.company_description.replace(/\r\n/g, "\n")),
      country, isExclusiveAgent: /furukawa rock drill|airman/i.test(name),
      kind: "PRINCIPAL", websiteUrl: null,
      youtubeRaw: c.company_youtubeLink,
      youtubeId: youtubeFix(c.company_youtubeLink)?.youtubeId ?? null,
      youtubeStart: youtubeFix(c.company_youtubeLink)?.startSeconds ?? null,
    });
  });
  return out;
}

function brandSlugForName(name: string): string {
  const n = name.toLowerCase();
  if (n.startsWith("furukawa")) return "furukawa-rock-drill-co";
  if (n.startsWith("airman")) return "airman";
  if (n.startsWith("walter")) return "walter-geratebou";
  if (n.startsWith("sumitomo")) return "sumitomo-construction-machinery";
  return slugify(name);
}

export function serviceRows(): Row[] {
  return (servicesJson as { _id: string; title: string; shortDescription: string; image: string; contentList: string[] }[]).map((s, i) => {
    const slug = slugify(s.title);
    const features = s.contentList.map((line) => {
      const clean = line.replace(/\r?\n/g, " ").trim();
      const m = clean.match(/^(.*?)\s+[–-]\s+(.*)$/);
      const title = (m?.[1] ?? clean).replace(/^redictive/i, "Predictive");
      return { title, description: m?.[2] ?? null };
    });
    return { ...base(`svc-${slug}`, i + 1), slug, title: s.title.trim(), shortDescription: s.shortDescription.trim(), features, bodyHtml: null, process: [], relatedBrandSlugs: [], relatedProductSlugs: [] };
  });
}

/** Videos: brand videos (from company.json) and the six featured YouTube ids from amendment A6. */
export function videoRows(brands: Row[]): Row[] {
  const out: Row[] = [];
  brands.forEach((b, i) => {
    if (!b.youtubeId) return;
    out.push({ ...base(`vid-brand-${b.slug}`, i + 1), title: `${b.name} video`, description: null, sourceType: "YOUTUBE", youtubeId: b.youtubeId as string, startSeconds: (b.youtubeStart as number | null) ?? null, mediaUrl: null, posterUrl: null, brandSlug: b.slug, productSlug: null, isFeatured: false, durationSeconds: null });
  });
  const featured = ["AJSPVh_fCoY", "C8uXNLChKuo", "gnwQx7AC2ws", "pyoNPfUgJJo", "q9M_eFAnwPs", "uQlNhObyLu8"];
  featured.forEach((id, i) => {
    out.push({ ...base(`vid-featured-${i + 1}`, 100 + i), title: `BARATON featured video ${i + 1}`, description: null, sourceType: "YOUTUBE", youtubeId: id, startSeconds: null, mediaUrl: null, posterUrl: null, brandSlug: null, productSlug: null, isFeatured: true, durationSeconds: null });
  });
  // Sample upload (amendment A6): a locally generated test clip served from /mock/sample-clip.mp4.
  out.push({ ...base("vid-upload-sample", 200), title: "Sample uploaded clip (mock)", description: "Development sample for the native upload player.", sourceType: "UPLOAD", youtubeId: null, startSeconds: null, mediaUrl: "/mock/sample-clip.mp4", posterUrl: null, brandSlug: null, productSlug: null, isFeatured: false, durationSeconds: 4 });
  return out;
}

export const OFFICE_ADDIS = {
  id: "office-addis",
  name: "Baraton Trade PLC, Addis Ababa",
  isPrimary: true,
  lines: ["Bole Road, Wollo Sefer", "Addis Ababa, Ethiopia", "P.O.Box 62716"],
  city: "Addis Ababa",
  countryName: "Ethiopia",
  latitude: 9.0054,
  longitude: 38.7636,
  mapEmbedUrl: null,
  openingHours: null,
};

export const CHANNELS = [
  { id: "ch-phone-1", type: "PHONE" as const, label: "Phone", value: "+251911514558", displayValue: "+251 911 514558", href: "tel:+251911514558", showOnContactPage: true, showInFooter: true, showInHeader: true },
  { id: "ch-phone-2", type: "PHONE" as const, label: "Phone", value: "+251911175644", displayValue: "+251 911 175644", href: "tel:+251911175644", showOnContactPage: true, showInFooter: true, showInHeader: false },
  { id: "ch-phone-3", type: "PHONE" as const, label: "Phone", value: "+251114709133", displayValue: "+251 114 709133", href: "tel:+251114709133", showOnContactPage: true, showInFooter: true, showInHeader: false },
  { id: "ch-email", type: "EMAIL" as const, label: "Email", value: "aboma.taye@gmail.com", displayValue: "aboma.taye@gmail.com", href: "mailto:aboma.taye@gmail.com", showOnContactPage: true, showInFooter: true, showInHeader: false },
];

export const ABOUT_STRINGS = {
  ceo: [
    "Since our company's founding in 2007, we have been committed to fostering a prosperous society in Ethiopia by delivering efficient, user-friendly products to customers in the construction and mining industries. Our solutions play a vital role in the development of social infrastructure.",
    "We will continue to build on the strong foundation we have established, striving for leadership in our industry. By exploring new marketing opportunities and innovative ideas, we aim to provide original products and services that meet evolving needs. Our commitment extends to creating a sustainable society by working collaboratively with our suppliers and end users.",
  ],
  mission: [
    "Committed to excellence by leveraging our competitive advantages in every field we operate.",
    "Upholding the highest standards of business ethics and organizational values.",
    "Delivering customer satisfaction through exceptional products and services.",
    "Cultivating a culture of trust, openness, and mutual respect, making our workplace both stimulating and rewarding.",
  ],
  vision: "To be a regional leader in our industry, driven by sustainable growth, knowledge, excellence, and best practices. As we face the challenges ahead, we will stay agile, adapting to the evolving world while remaining a trusted partner for the companies that rely on us. Together, we shape the future!",
  storyParagraphs: [
    "BARATON Group began operating in 2007, as importer and distributor of Tata-Daewoo truck spare parts and heavy construction machinery rental in Ethiopia. Over the next 17 years, the company grew significantly, diversifying its operations to include the import and sale of a variety of products.",
    "These included FURUKAWA Rock Drilling Machines from Japan, AIRMAN Air Compressors from Japan, HIFI Filtration Solutions from Switzerland, and ROBIT Rock Drilling Accessories from Finland. The company also ventured into construction sales and rental of real estate properties in the US, Kenya, and Ethiopia.",
    "In 2019, BARATON Group expanded further by setting up a USA-based subsidiary, BARATON Trade LLC, and a woodworking factory. This marked the transition to the BARATON Group.",
    "Since its formation, the BARATON Group has strengthened its customer services and broadened its resource access in key hub countries. Today, the group provides a wide array of services, including rock drilling, compressed air systems, filtration, construction machinery attachments, and real estate.",
  ],
  capabilities: ["Construction machinery", "Rock drilling tools", "Hydraulic attachments", "Equipment servicing & support"],
};
