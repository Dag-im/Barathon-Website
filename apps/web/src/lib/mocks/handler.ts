/**
 * DEV-ONLY mock router. Active only when NEXT_PUBLIC_USE_MOCKS=1 outside
 * production (see lib/env.ts). Serves public DTOs derived from the seed and
 * an in-memory admin store, so both sites can be exercised without the API.
 * Admin edits last until the dev server restarts.
 */
import { ApiError } from "@/lib/api/errors";
import type {
  BrandCardDto, BrandDto, BlockDto, CategoryDto, FaqGroupDto, MediaDto, PageDto, ProductCardDto, ProductDto,
  ServiceCardDto, ServiceDto, SiteDto, VideoDto, SeoDto, MeDto, MessageDto,
} from "@/lib/api/types";
import { youtubeThumb } from "@/lib/utils/youtube";
import { env } from "@/lib/env";
import {
  ABOUT_STRINGS, CATEGORY_NAMES, CHANNELS, OFFICE_ADDIS, PH, brandRows, media, nowIso, productRows,
  serviceRows, videoRows, normaliseCountry, type Row,
} from "./seed";

type Q = Record<string, string | number | boolean | null | undefined>;
interface Store { products: Row[]; brands: Row[]; services: Row[]; videos: Row[]; testimonials: Row[]; posts: Row[]; faqGroups: Row[]; messages: Row[]; redirects: Row[]; audit: Row[]; settings: Row[]; pages: Row[] }

let state: Store | null = null;
let mustChange = false;

function init(): Store {
  const brands = brandRows();
  const services = serviceRows();
  const products = productRows();
  const videos = videoRows(brands);
  return {
    products, brands, services, videos,
    testimonials: [], posts: [], faqGroups: [],
    messages: [], redirects: [], audit: [], settings: [], pages: [],
  };
}

const store = (): Store => {
  if (!state) state = init();
  return state;
};

const sortBy = <T extends { sortOrder: number }>(rows: T[]) => [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
const isLive = (r: Row) => r.status === "PUBLISHED" && r.deletedAt === null;
const str = (r: Row, k: string): string => (typeof r[k] === "string" ? (r[k] as string) : "");

/* ---------- SEO ---------- */
function seo(title: string, description: string | null, path: string, type: "website" | "article" | "product" = "website", image: MediaDto | null = null, extra: { noindex?: boolean; jsonLd?: Record<string, unknown>[] } = {}): SeoDto {
  const siteName = "Baraton Group Co.";
  const full = path === "/" ? title : `${title} | ${siteName}`;
  const canonical = `${env.siteUrl}${path}`;
  return {
    title: full.length > 70 ? full.slice(0, 69) + "…" : full,
    description,
    canonical,
    robots: extra.noindex ? "noindex,follow" : "index,follow",
    openGraph: { title, description, type, url: canonical, image: image ?? PH.generic(siteName), siteName, locale: "en_US" },
    twitter: { card: "summary_large_image", title, description, image: null, site: null },
    jsonLd: extra.jsonLd ?? [],
  };
}

/* ---------- DTO builders ---------- */
const productCard = (p: Row): ProductCardDto => {
  const brand = store().brands.find((b) => b.slug === p.brandSlug);
  const cat = p.categorySlug as string;
  return {
    id: p.id, slug: p.slug as string, title: p.title as string, shortDescription: p.shortDescription as string,
    image: PH.product(p.title as string), brand: brand ? { slug: brand.slug as string, name: brand.name as string, logo: PH.logo(brand.name as string) } : null,
    category: cat ? { slug: cat, name: CATEGORY_NAMES[cat] ?? cat } : null,
    country: p.country as ProductCardDto["country"], isFeatured: Boolean(p.isFeatured), href: `/products/${p.slug}`,
  };
};

const videoDto = (v: Row): VideoDto => {
  const brand = store().brands.find((b) => b.slug === v.brandSlug);
  const product = store().products.find((p) => p.slug === v.productSlug);
  const yt = v.sourceType === "YOUTUBE";
  return {
    id: v.id, title: v.title as string, description: (v.description as string | null) ?? null,
    sourceType: yt ? "YOUTUBE" : "UPLOAD", youtubeId: (v.youtubeId as string | null) ?? null,
    startSeconds: (v.startSeconds as number | null) ?? null, mediaUrl: (v.mediaUrl as string | null) ?? null,
    posterUrl: (v.posterUrl as string | null) ?? null,
    thumbnailUrl: yt && v.youtubeId ? youtubeThumb(v.youtubeId as string) : null,
    poster: null,
    brand: brand ? { slug: brand.slug as string, name: brand.name as string } : null,
    product: product ? { slug: product.slug as string, name: product.title as string } : null,
    isFeatured: Boolean(v.isFeatured), published: isLive(v), sortOrder: v.sortOrder, durationSeconds: (v.durationSeconds as number | null) ?? null,
    updatedAt: v.updatedAt as string,
  };
};

const brandCard = (b: Row): BrandCardDto => ({
  id: b.id, slug: b.slug as string, name: b.name as string, kind: "PRINCIPAL", shortDescription: b.shortDescription as string,
  logo: PH.logo(b.name as string), logoDark: null, country: b.country as BrandCardDto["country"], href: `/brands/${b.slug}`,
  isExclusiveAgent: Boolean(b.isExclusiveAgent),
});

const serviceCard = (s: Row): ServiceCardDto => ({
  id: s.id, slug: s.slug as string, title: s.title as string, shortDescription: s.shortDescription as string,
  image: PH.generic(s.title as string), iconName: null, features: s.features as ServiceCardDto["features"], href: `/services/${s.slug}`,
});

const liveProducts = () => sortBy(store().products.filter(isLive));
const liveBrands = () => sortBy(store().brands.filter(isLive));
const liveServices = () => sortBy(store().services.filter(isLive));
const liveVideos = () => sortBy(store().videos.filter(isLive));

function categories(): CategoryDto[] {
  const counts = new Map<string, number>();
  for (const p of liveProducts()) {
    const c = p.categorySlug as string;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].map(([slug, n], i) => ({
    id: `cat-${slug}`, slug, name: CATEGORY_NAMES[slug] ?? slug, description: null, image: null, parentSlug: null,
    productCount: n, sortOrder: i,
  })) as unknown as CategoryDto[];
}

function productDto(p: Row): ProductDto {
  const card = productCard(p);
  const cat = p.categorySlug as string;
  const related = liveProducts().filter((x) => x.slug !== p.slug && (x.categorySlug === cat || (x.brandSlug && x.brandSlug === p.brandSlug))).slice(0, 4).map(productCard);
  const videos = liveVideos().filter((v) => v.productSlug === p.slug).map(videoDto);
  return {
    ...card,
    contentHtml: p.contentHtml as string,
    tagline: null, partNumber: null, inquiryEnabled: true,
    gallery: [],
    specs: [], documents: [], features: (p.features as string[]) ?? [],
    related, videos,
    publishedAt: p.createdAt as string, updatedAt: p.updatedAt as string,
    seo: seo(p.title as string, p.shortDescription as string, card.href, "product", card.image, {
      jsonLd: [{ "@type": "Product", name: p.title, description: p.shortDescription, image: [PH.product(p.title as string).url], brand: card.brand ? { "@type": "Brand", name: card.brand.name } : undefined }],
    }),
  };
}

function brandDto(b: Row): BrandDto {
  const card = brandCard(b);
  return {
    ...card, descriptionHtml: b.descriptionHtml as string, heroImage: null, websiteUrl: null,
    videos: liveVideos().filter((v) => v.brandSlug === b.slug).map(videoDto),
    products: liveProducts().filter((p) => p.brandSlug === b.slug).map(productCard),
    seo: seo(b.name as string, b.shortDescription as string, card.href, "website", card.logo, {
      jsonLd: [{ "@type": "Brand", name: b.name, description: b.shortDescription, logo: card.logo?.url }],
    }),
  };
}

function serviceDto(s: Row): ServiceDto {
  const card = serviceCard(s);
  return {
    ...card, bodyHtml: null, ctaLabel: "Request this service", ctaHref: `/contact?service=${s.slug}`,
    process: [], relatedBrands: liveBrands().slice(0, 3).map(brandCard), relatedProducts: liveProducts().slice(0, 3).map(productCard), faqs: [],
    seo: seo(s.title as string, s.shortDescription as string, card.href, "website", null, { jsonLd: [{ "@type": "Service", name: s.title, description: s.shortDescription, provider: { "@type": "Organization", name: "Baraton Group Co." } }] }),
  };
}

function site(): SiteDto {
  const products = liveProducts();
  const featured = products.filter((p) => p.isFeatured);
  const menus = {
    HEADER: [
      { id: "h-home", label: "Home", href: "/", target: "SELF" as const, icon: null, children: [] },
      { id: "h-about", label: "About Us", href: "/about", target: "SELF" as const, icon: null, children: [] },
      { id: "h-products", label: "Products", href: "/products", target: "SELF" as const, icon: null, children: categories().map((c) => ({ id: `hc-${c.slug}`, label: c.name, href: `/products/category/${c.slug}`, target: "SELF" as const, icon: null, children: [] })), viewAll: { label: "View all products", href: "/products" } },
      { id: "h-service", label: "Service", href: "/services", target: "SELF" as const, icon: null, children: [] },
      { id: "h-contact", label: "Contact Us", href: "/contact", target: "SELF" as const, icon: null, children: [] },
    ],
    FOOTER_QUICK: [
      { id: "fq-about", label: "About Us", href: "/about", target: "SELF" as const, icon: null, children: [] },
      { id: "fq-products", label: "Our Products", href: "/products", target: "SELF" as const, icon: null, children: [] },
      { id: "fq-services", label: "Our Services", href: "/services", target: "SELF" as const, icon: null, children: [] },
      { id: "fq-brands", label: "Brands", href: "/brands", target: "SELF" as const, icon: null, children: [] },
      { id: "fq-contact", label: "Contact Us", href: "/contact", target: "SELF" as const, icon: null, children: [] },
    ],
    FOOTER_PRODUCTS: featured.slice(0, 5).map((p) => ({ id: `fp-${p.slug}`, label: p.title as string, href: `/products/${p.slug}`, target: "SELF" as const, icon: null, children: [] })),
    FOOTER_LEGAL: [],
  };
  return {
    siteName: "Baraton Group Co.", legalName: "Baraton Group Co.", tagline: "Importer and distributor since 2007",
    locale: "en", logoLight: PH.logo("Baraton Group Co. logo"), logoDark: null, favicon: null, appleTouchIcon: null, defaultOgImage: null,
    brandColors: { primary: "#2F447D", accent: "#843C40", themeColor: "#2F447D" },
    headerCta: { enabled: true, label: "Let's Talk", hrefType: "PATH", href: "/contact", icon: "phone" },
    search: { enabled: true, placeholder: "Search products..." },
    footer: {
      blurb: ABOUT_STRINGS.storyParagraphs[0]?.split(". ")[0] ? "Founded in 2007, BARATON Group started with importing Tata-Daewoo trucks spare parts and has grown into a diversified importer and distributor." : null,
      copyright: `© ${new Date().getFullYear()} Baraton Group Co. All rights reserved.`,
      credit: { enabled: true, prefix: "Developed by", name: "Dagim Meseret", url: env.developerUrl || null },
    },
    announcement: null, maintenance: { enabled: false, message: null },
    analytics: { ga4Id: null, gtmId: null, searchConsoleVerification: null },
    seoDefaults: { titleTemplate: "%s | Baraton Group Co.", defaultTitle: "Baraton Group Co. | Rock Drilling, Air Compressors & Construction Machinery in Ethiopia", defaultDescription: "Importer and distributor since 2007: genuine rock drills, compressors, crushers and construction machinery, with parts and field service in Ethiopia.", twitterHandle: null, siteNoindex: !env.enableIndexing },
    contactForm: { consentRequired: false, consentText: null, captchaProvider: "NONE", captchaSiteKey: null },
    social: [],
    channels: CHANNELS,
    offices: [OFFICE_ADDIS, { id: "office-florida", name: "Baraton Trade LLC, Florida", isPrimary: false, lines: [], city: "Florida", countryName: "USA", latitude: null, longitude: null, mapEmbedUrl: null, openingHours: null }],
    menus,
    uiStrings: {},
  };
}

const para = (items: string[]) => items.map((p) => `<p>${p}</p>`).join("");

function homeBlocks(): BlockDto[] {
  const featured = liveProducts().filter((p) => p.isFeatured);
  const countries = new Set(liveProducts().map((p) => (p.country as { name: string | null }).name).filter(Boolean));
  const base = { anchorId: null, navLabel: null, showInTabNav: false };
  return [
    { ...base, id: "b-hero", type: "HERO_CAROUSEL", autoplayMs: 6000, showThumbnails: true, showCounter: true,
      slides: featured.slice(0, 8).map((p) => ({
        id: `slide-${p.slug}`, eyebrow: (p.country as { name: string | null }).name, heading: p.title as string, subheading: p.shortDescription as string,
        image: PH.product(p.title as string), mobileImage: null, overlayOpacity: 0.85, buttons: [{ label: "View product", href: `/products/${p.slug}` }], href: `/products/${p.slug}`,
      })) },
    { ...base, id: "b-brands", type: "BRANDS_MARQUEE", speed: "NORMAL", linkToBrand: true, grayscale: true, title: "Brands We Work With", subtitle: "Trusted by industry leaders worldwide", brands: liveBrands().map(brandCard) },
    { ...base, id: "b-story", type: "IMAGE_TEXT", image: PH.logo("BARATON Group story"), imagePosition: "RIGHT", heading: "The group", bodyHtml: para(ABOUT_STRINGS.storyParagraphs), buttons: [{ label: "Learn more", href: "/about", variant: "PRIMARY", target: "SELF" }, { label: "Our Products", href: "/products", variant: "SECONDARY", target: "SELF" }] },
    { ...base, id: "b-stats", type: "STATS", stats: [
      { id: "s1", value: 2007, prefix: null, suffix: null, label: "Founded", icon: null },
      { id: "s2", value: liveBrands().length, prefix: null, suffix: null, label: "Partner brands", icon: null },
      { id: "s3", value: liveProducts().length, prefix: null, suffix: null, label: "Product lines", icon: null },
      { id: "s4", value: countries.size, prefix: null, suffix: null, label: "Countries of manufacture", icon: null },
    ] },
    { ...base, id: "b-featured", type: "FEATURED_PRODUCTS", layout: "GRID", title: "Our Products", products: featured.slice(0, 6).map(productCard), viewAll: { label: "View all products", href: "/products" } },
    { ...base, id: "b-services", type: "SERVICES_GRID", title: "Our Services", services: liveServices().map(serviceCard), cta: { label: "Request a service", href: "/contact?subject=service" } },
    { ...base, id: "b-videos", type: "VIDEOS_GRID", layout: "FEATURED", title: "Featured Videos", subtitle: "Discover our work through these immersive experiences", videos: liveVideos().filter((v) => v.isFeatured).slice(0, 6).map(videoDto) },
    { ...base, id: "b-cta", type: "CTA_BANNER", heading: "Need a machine, a part or a service quote?", text: "Tell us what you run. We reply with availability and lead time.", backgroundImage: null, buttons: [{ label: "Let's Talk", href: "/contact", variant: "PRIMARY" }] },
  ] as BlockDto[];
}

function aboutBlocks(): BlockDto[] {
  const base = { anchorId: null, navLabel: null, showInTabNav: false };
  return [
    { ...base, id: "a-story", type: "IMAGE_TEXT", image: null, imagePosition: "RIGHT", heading: "Our story", bodyHtml: para(ABOUT_STRINGS.storyParagraphs), buttons: [] },
    { ...base, id: "a-timeline", type: "TIMELINE", orientation: "VERTICAL", entries: [
      { id: "t1", yearLabel: "2007", title: "Import and distribution begins", descriptionHtml: "<p>Import and distribution of Tata-Daewoo truck spare parts and heavy construction machinery rental in Ethiopia.</p>", image: null, icon: null },
      { id: "t2", yearLabel: "2019", title: "BARATON Trade LLC and a woodworking factory", descriptionHtml: "<p>A USA-based subsidiary and a woodworking factory mark the transition to the BARATON Group.</p>", image: null, icon: null },
    ] },
    { ...base, id: "a-ceo", type: "LEADER_MESSAGE", leader: { id: "leader-ceo", heading: "CEO's Message", name: null, jobTitle: "Chief Executive Officer", photo: null, signature: null, messageHtml: para(ABOUT_STRINGS.ceo) } },
    { ...base, id: "a-mission", type: "MISSION_VISION", missionTitle: "Mission", visionTitle: "Vision", visionHtml: `<p>${ABOUT_STRINGS.vision}</p>`, missionItems: ABOUT_STRINGS.mission.map((t, i) => ({ id: `mv${i}`, group: "MISSION" as const, title: t, description: null, icon: null })) },
    { ...base, id: "a-subs", type: "SUBSIDIARIES", layout: "STACKED", subsidiaries: subsidiaries() },
    { ...base, id: "a-caps", type: "CORE_VALUES", layout: "LIST", values: ABOUT_STRINGS.capabilities.map((t, i) => ({ id: `cap${i}`, group: "VALUE" as const, title: t, description: null, icon: null })) },
    { ...base, id: "a-brands", type: "BRANDS_MARQUEE", speed: "NORMAL", linkToBrand: true, grayscale: true, title: "Brands We Work With", brands: liveBrands().map(brandCard) },
    { ...base, id: "a-cta", type: "CTA_BANNER", heading: "Talk to the group", text: null, backgroundImage: null, buttons: [{ label: "Let's Talk", href: "/contact", variant: "PRIMARY" }] },
  ] as BlockDto[];
}

function subsidiaries() {
  const ref = (slug: string) => liveBrands().find((b) => b.slug === slug);
  const furukawa = ref("furukawa-rock-drill-co");
  const airman = ref("airman");
  return [
    {
      id: "sub-llc", slug: "baraton-trade-llc", name: "Baraton Trade LLC", legalName: null, countryCode: "US", regionNote: "Florida, USA",
      tagline: null, introHtml: "<p>A subsidiary of Baraton Group, Baraton Trade LLC operates globally, offering innovative and reliable product solutions. Licensed in Florida, USA, the company prioritizes exceptional customer service and strong relationships.</p>",
      bodyHtml: "<p>With a focus on quality and integrity, Baraton Trade LLC ensures clients receive top-notch support while driving industry advancements through continuous innovation.</p>",
      lists: [{ title: "Services", style: "CHECKS" as const, items: ["Technological Solutions", "Real Estate Development & Portfolio Management", "Stock & Share Portfolio Management", "Global Product Distribution"] }],
      partnerBrands: [
        ...(furukawa ? [{ brand: brandCard(furukawa), relation: "EXCLUSIVE_RIGHTS" as const }] : []),
        ...(airman ? [{ brand: brandCard(airman), relation: "EXCLUSIVE_RIGHTS" as const }] : []),
      ],
      logo: null, image: null, websiteUrl: null, anchorId: "baraton-trade-llc",
    },
    {
      id: "sub-plc", slug: "baraton-trade-plc", name: "Baraton Trade PLC", legalName: null, countryCode: "ET", regionNote: "Ethiopia",
      tagline: "Official agent of Furukawa and Airman in Ethiopia", introHtml: "<p>A proud subsidiary of Baraton Group, Baraton Trade PLC is the official agent of Furukawa Rock Drills Co., Ltd and Airman Corporation Ltd in Ethiopia.</p><p>With the expertise of our consultants and certified engineers, we provide industry-leading solutions tailored to be efficient, reliable, and cost-effective.</p>",
      bodyHtml: "<p>Our authentic, high-quality parts are built to support the way you work. We recognize that fast access to the right parts, service, and support is critical to keeping your machines operating at peak performance.</p><p>Baraton Trade PLC delivers cutting-edge technology to help you stay connected on the job site, reducing downtime while maximizing productivity and profitability.</p>",
      lists: [{ title: "Support", style: "BULLETS" as const, items: ["Genuine replacement parts", "Technical support", "Self-repair resources"] }],
      partnerBrands: [
        ...(furukawa ? [{ brand: brandCard(furukawa), relation: "OFFICIAL_AGENT" as const }] : []),
        ...(airman ? [{ brand: brandCard(airman), relation: "OFFICIAL_AGENT" as const }] : []),
      ],
      logo: null, image: null, websiteUrl: null, anchorId: "baraton-trade-plc",
    },
  ] as unknown as import("@/lib/api/types").SubsidiaryDto[];
}

function pageFor(key: "home" | "about"): PageDto {
  const title = key === "home" ? "Home" : "About Us";
  const path = key === "home" ? "/" : "/about";
  return {
    id: `page-${key}`, slug: key, key, title, template: key === "home" ? "HOME" : "ABOUT",
    heroTitle: key === "home" ? "Rock drilling, compressed air and construction machinery for Ethiopia." : "About Us",
    heroSubtitle: key === "home" ? "Importer and distributor since 2007: genuine machines, parts and field service from Furukawa, Airman, Montabert and more." : ABOUT_STRINGS.storyParagraphs[0] ?? null,
    heroImage: null,
    blocks: key === "home" ? homeBlocks() : aboutBlocks(),
    tabNav: key === "about" ? [{ label: "CEO Message", anchorId: "a-ceo" }, { label: "Philosophy", anchorId: "a-mission" }, { label: "Baraton Trade LLC", anchorId: "baraton-trade-llc" }, { label: "Baraton Trade PLC", anchorId: "baraton-trade-plc" }] : [],
    updatedAt: nowIso(),
    seo: seo(key === "home" ? "Baraton Group Co. | Rock Drilling, Air Compressors & Construction Machinery in Ethiopia" : title, key === "home" ? "Importer and distributor since 2007: genuine rock drills, compressors, crushers and construction machinery, with parts and field service in Ethiopia." : "About Baraton Group Co., importer and distributor in Ethiopia since 2007.", path, "website", null, {
      jsonLd: key === "home" ? [{ "@type": "WebPage", name: title }] : [{ "@type": "AboutPage", name: title }],
    }),
  };
}

/* ---------- admin helpers ---------- */
const meDto = (): MeDto => ({ id: "u-admin", email: "admin@barathon.local", name: "Site admin", role: "ADMIN", avatar: null, mustChangePassword: mustChange, twoFactorEnabled: false, csrfToken: "mock-csrf" });

function paginate<T>(rows: T[], page = 1, pageSize = 20) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { data: rows.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total, totalPages } };
}

const ADMIN_RESOURCES: Record<string, keyof Store> = {
  products: "products", brands: "brands", services: "services", videos: "videos",
  testimonials: "testimonials", posts: "posts", "faq-groups": "faqGroups", redirects: "redirects", messages: "messages",
};

function adminList(res: keyof Store, query: Q | undefined) {
  const q = String(query?.q ?? "").toLowerCase();
  const status = query?.status ? String(query.status) : "";
  let rows = [...store()[res]].filter((r) => r.deletedAt === null);
  if (q) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  if (status) rows = rows.filter((r) => r.status === status);
  return paginate(sortBy(rows), Number(query?.page ?? 1), Number(query?.pageSize ?? 50));
}

function audit(action: string, entityType: string, entityId: string, summary: string) {
  store().audit.unshift({ id: `aud-${store().audit.length + 1}`, action, entityType, entityId, summary, diff: null, actorEmail: "admin@barathon.local", ip: "127.0.0.1", createdAt: nowIso(), status: "PUBLISHED", sortOrder: 0, version: 1, updatedAt: nowIso(), deletedAt: null });
}

const notFound = (what = "Resource") => new ApiError(404, "NOT_FOUND", `${what} not found`);

/* ---------- router ---------- */
export async function mockRequest<T>(method: string, path: string, query?: Q, body?: unknown): Promise<T> {
  const p = path.split("?")[0]!;
  const b = (body ?? {}) as Record<string, unknown>;
  const ok = <R>(v: unknown) => v as R;
  const pub = (m: RegExpMatchArray | null) => m;

  // Public read endpoints
  if (method === "GET") {
    if (p === "/public/site") return ok<T>(site());
    if (p === "/public/menus") return ok<T>({ data: [] });
    if (p === "/public/pages") return ok<T>({ data: [{ slug: "home", title: "Home", updatedAt: nowIso() }, { slug: "about", title: "About Us", updatedAt: nowIso() }] });
    let m = pub(p.match(/^\/public\/pages\/([^/]+)$/));
    if (m) {
      if (m[1] === "home" || m[1] === "about") return ok<T>(pageFor(m[1]));
      throw notFound("Page");
    }
    if (p === "/public/products") {
      const page = Number(query?.page ?? 1);
      const pageSize = Number(query?.pageSize ?? 12);
      let rows = liveProducts();
      const q = String(query?.q ?? "").toLowerCase();
      if (q) rows = rows.filter((r) => `${r.title} ${r.shortDescription}`.toLowerCase().includes(q));
      if (query?.category) rows = rows.filter((r) => r.categorySlug === query.category);
      if (query?.brand) rows = rows.filter((r) => r.brandSlug === query.brand);
      if (query?.country) rows = rows.filter((r) => ((r.country as { name: string | null }).name ?? "").toLowerCase() === String(query.country).toLowerCase());
      if (query?.featured === true || query?.featured === "true") rows = rows.filter((r) => r.isFeatured);
      if (query?.sort === "title") rows = [...rows].sort((a, b) => String(a.title).localeCompare(String(b.title)));
      const facetsSrc = liveProducts();
      const countBy = <T,>(arr: T[], key: (x: T) => string, label: (x: T) => string) => {
        const map = new Map<string, { slug: string; name: string; count: number }>();
        for (const x of arr) { const k = key(x); if (!k) continue; const e = map.get(k) ?? { slug: k, name: label(x), count: 0 }; e.count++; map.set(k, e); }
        return [...map.values()];
      };
      const result = paginate(rows.map(productCard), page, pageSize);
      return ok<T>({
        ...result,
        facets: {
          categories: countBy(facetsSrc, (x) => String(x.categorySlug ?? ""), (x) => CATEGORY_NAMES[String(x.categorySlug)] ?? ""),
          brands: countBy(facetsSrc.filter((x) => x.brandSlug), (x) => String(x.brandSlug), (x) => brandName(String(x.brandSlug))),
          countries: countBy(facetsSrc, (x) => ((x.country as { name: string | null }).name ?? ""), (x) => ((x.country as { name: string | null }).name ?? "")).map((c) => ({ code: c.slug, name: c.name, count: c.count })),
        },
      });
    }
    m = pub(p.match(/^\/public\/products\/([^/]+)$/));
    if (m) {
      const row = liveProducts().find((r) => r.slug === m![1]);
      if (!row) throw notFound("Product");
      return ok<T>(productDto(row));
    }
    if (p === "/public/product-categories") return ok<T>({ data: categories() });
    m = pub(p.match(/^\/public\/product-categories\/([^/]+)$/));
    if (m) {
      const c = categories().find((x) => x.slug === m![1]);
      if (!c) throw notFound("Category");
      return ok<T>(c);
    }
    if (p === "/public/brands") return ok<T>(paginate(liveBrands().map(brandCard), 1, 100));
    m = pub(p.match(/^\/public\/brands\/([^/]+)$/));
    if (m) {
      const row = liveBrands().find((r) => r.slug === m![1]);
      if (!row) throw notFound("Brand");
      return ok<T>(brandDto(row));
    }
    if (p === "/public/services") return ok<T>({ data: liveServices().map(serviceCard) });
    m = pub(p.match(/^\/public\/services\/([^/]+)$/));
    if (m) {
      const row = liveServices().find((r) => r.slug === m![1]);
      if (!row) throw notFound("Service");
      return ok<T>(serviceDto(row));
    }
    if (p === "/public/videos") {
      let rows = liveVideos();
      if (query?.featured === true || query?.featured === "true") rows = rows.filter((v) => v.isFeatured);
      return ok<T>(paginate(rows.map(videoDto), 1, 48));
    }
    if (p === "/public/testimonials") return ok<T>({ data: [] });
    if (p === "/public/faqs") return ok<T>({ data: [] as FaqGroupDto[] });
    if (p === "/public/posts") return ok<T>(paginate([], 1, 9));
    if (p === "/public/redirects") return ok<T>({ data: store().redirects.map((r) => ({ source: r.source, target: r.target, type: "MOVED_301", match: "EXACT" })) });
    if (p === "/public/sitemap") {
      const entries = [
        ...["/", "/about", "/products", "/brands", "/services", "/contact"].map((loc) => ({ loc: `${env.siteUrl}${loc}`, lastmod: nowIso(), changefreq: "weekly" as const, priority: loc === "/" ? 1 : 0.7 })),
        ...liveProducts().map((r) => ({ loc: `${env.siteUrl}/products/${r.slug}`, lastmod: r.updatedAt as string, changefreq: "monthly" as const, priority: 0.8, images: [PH.product(r.title as string).url] })),
        ...liveBrands().map((r) => ({ loc: `${env.siteUrl}/brands/${r.slug}`, lastmod: r.updatedAt as string, changefreq: "monthly" as const, priority: 0.7 })),
        ...liveServices().map((r) => ({ loc: `${env.siteUrl}/services/${r.slug}`, lastmod: r.updatedAt as string, changefreq: "monthly" as const, priority: 0.7 })),
      ];
      return ok<T>({ data: entries });
    }
    if (p === "/public/search") {
      const q = String(query?.q ?? "").toLowerCase();
      const hit = (s: string) => s.toLowerCase().includes(q);
      return ok<T>({
        products: liveProducts().filter((r) => hit(`${r.title} ${r.shortDescription}`)).map(productCard),
        brands: liveBrands().filter((r) => hit(`${r.name} ${r.shortDescription}`)).map(brandCard),
        services: liveServices().filter((r) => hit(`${r.title} ${r.shortDescription}`)).map(serviceCard),
        posts: [], pages: [],
      });
    }
    if (p === "/public/contact") throw notFound();
  }

  if (method === "POST" && p === "/public/contact") {
    const id = `msg-${store().messages.length + 1}`;
    store().messages.unshift({ id, reference: `BTG-${1000 + store().messages.length + 1}`, name: String(b.name), email: String(b.email), phone: (b.phone as string) ?? null, message: String(b.message), subject: (b.subject as string) ?? null, productTitle: (b.productSlug as string) ?? null, status: "NEW", isStarred: false, createdAt: nowIso(), sourcePath: (b.sourcePath as string) ?? null, notes: [], readAt: null, repliedAt: null, ip: null, userAgent: null, spamScore: 0, spamReasons: [], notificationStatus: "SENT", sortOrder: 0, version: 1, updatedAt: nowIso(), deletedAt: null, excerpt: String(b.message).slice(0, 120) });
    return ok<T>({ id, reference: `BTG-${1000 + store().messages.length}`, message: "Thank you. Your message has been received." });
  }

  // Auth
  if (p === "/auth/login" && method === "POST") { mustChange = false; return ok<T>({ status: "OK", user: meDto(), mustChangePassword: false, csrfToken: "mock-csrf" }); }
  if (p === "/auth/logout" && method === "POST") return ok<T>(undefined);
  if (p === "/auth/refresh" && method === "POST") return ok<T>({ user: meDto(), csrfToken: "mock-csrf" });
  if (p === "/auth/me" && method === "GET") return ok<T>(meDto());
  if (p === "/auth/forgot-password" && method === "POST") { mustChange = true; return ok<T>({ message: "If the account exists, its password was reset to the default password. Sign in and you will be asked to choose a new one." }); }
  if (p === "/auth/change-password" && method === "POST") { mustChange = false; return ok<T>(undefined); }
  if (p === "/auth/sessions" && method === "GET") return ok<T>({ data: [{ id: "sess-current", deviceLabel: "This browser", ip: "127.0.0.1", createdAt: nowIso(), lastUsedAt: nowIso(), current: true }] });
  if (p.startsWith("/auth/sessions/") && method === "DELETE") return ok<T>(undefined);

  // Admin
  if (p === "/admin/dashboard") {
    const s = store();
    return ok<T>({
      counts: {
        products: { total: s.products.length, published: s.products.filter(isLive).length, draft: s.products.filter((r) => r.status === "DRAFT").length },
        brands: { total: s.brands.length, published: s.brands.filter(isLive).length },
        services: { total: s.services.length, published: s.services.filter(isLive).length },
        posts: { total: s.posts.length, published: 0 },
        videos: { total: s.videos.length, published: s.videos.filter(isLive).length },
      },
      messages: { new: s.messages.filter((m) => m.status === "NEW").length, total: s.messages.length, last7d: [0, 0, 0, 0, 0, 0, s.messages.length] },
      recentMessages: s.messages.slice(0, 5),
      recentActivity: s.audit.slice(0, 10),
      upcomingScheduled: [],
      health: { db: "ok", storage: "ok", mail: "unconfigured", jobsBacklog: 0, lastRevalidation: null },
      warnings: { missingImages: s.products.filter((r) => !r.image).map((r) => ({ entityType: "product", id: r.id, title: r.title as string })), missingSeoDescription: 0, unusedMedia: 0, draftOlderThan30d: 0, socialLinksMissing: true },
    } as unknown as T);
  }
  if (p === "/admin/settings" && method === "GET") return ok<T>({ siteName: "Baraton Group Co.", legalName: "Baraton Group Co.", tagline: site().tagline, offices: [OFFICE_ADDIS], channels: CHANNELS, seoDefaults: site().seoDefaults, footer: site().footer, analytics: site().analytics, version: 1 } as unknown as T);
  if (p === "/admin/settings" && method === "PUT") return ok<T>({ ...b, version: 2 } as unknown as T);
  if (p === "/admin/menus/HEADER" || p === "/admin/menus/FOOTER_QUICK") return ok<T>({ location: p.split("/").pop()!, items: site().menus[p.endsWith("HEADER") ? "HEADER" : "FOOTER_QUICK"] } as unknown as T);
  if (p === "/admin/pages/by-key/home" || p === "/admin/pages/by-key/about") return ok<T>({ ...pageFor(p.endsWith("home") ? "home" : "about"), id: p.endsWith("home") ? "page-home" : "page-about" } as unknown as T);
  if (p === "/admin/media" && method === "GET") return ok<T>(paginate([PH.product("Placeholder product image"), PH.logo("Placeholder logo"), PH.generic("Placeholder generic image")], 1, 50));
  if (p === "/admin/audit-log") return ok<T>(paginate(store().audit, Number(query?.page ?? 1), 50));

  if (/^\/admin\/pages\/[^/]+\/blocks$/.test(p) && method === "PUT") return ok<T>(undefined);

  // Generic CRUD over the admin resources
  const crud = pub(p.match(/^\/admin\/([a-z-]+)(?:\/([^/]+))?(?:\/(publish|unpublish|archive|restore|duplicate))?$/));
  if (crud && ADMIN_RESOURCES[crud[1]!]) {
    const res = ADMIN_RESOURCES[crud[1]!]!;
    const id = crud[2];
    const action = crud[3];
    if (!id && method === "GET") return ok<T>(adminList(res, query));
    if (!id && method === "POST") {
      const row = { ...b, id: `${crud[1]}-${Date.now()}`, status: "DRAFT", sortOrder: store()[res].length + 1, version: 1, createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null } as Row;
      store()[res].push(row);
      audit("CREATE", crud[1]!, row.id, `Created ${crud[1]}`);
      return ok<T>(row);
    }
    const row = store()[res].find((r) => r.id === id);
    if (!row) throw notFound();
    if (!action && method === "GET") return ok<T>(row);
    if (!action && method === "PATCH") { Object.assign(row, b, { version: row.version + 1, updatedAt: nowIso() }); audit("UPDATE", crud[1]!, row.id, `Updated ${crud[1]}`); return ok<T>(row); }
    if (!action && method === "DELETE") { row.deletedAt = nowIso(); audit("DELETE", crud[1]!, row.id, `Deleted ${crud[1]}`); return ok<T>(undefined); }
    if (action === "publish" || action === "unpublish" || action === "archive") {
      row.status = action === "publish" ? "PUBLISHED" : action === "archive" ? "ARCHIVED" : "DRAFT";
      row.updatedAt = nowIso();
      audit(action.toUpperCase(), crud[1]!, row.id, `${action} ${crud[1]}`);
      return ok<T>(row);
    }
  }

  throw new ApiError(404, "NOT_FOUND", `Mock route not implemented: ${method} ${p}`);
}

function brandName(slug: string): string {
  return store().brands.find((b) => b.slug === slug)?.name as string ?? slug;
}

export { normaliseCountry, media, PH };
export type { MessageDto };
