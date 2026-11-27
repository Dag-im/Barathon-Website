/**
 * API contract types, mirroring docs/plan/backend-plan.md section 10 (DTOs)
 * with the approved amendment A6 video fields. Hand-written because the API
 * is developed in parallel; regenerate from openapi when the API snapshot lands.
 */
export type UUID = string;
export type ISODate = string;
export type ContentStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface MediaVariant { label: string; format: "webp" | "avif" | "jpeg" | "png"; width: number; height: number; url: string }
export interface MediaDto {
  id: UUID;
  kind: "IMAGE" | "SVG" | "ICON" | "DOCUMENT" | "VIDEO";
  url: string;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  dominantColor: string | null;
  lqip: string | null;
  focal: { x: number; y: number } | null;
  variants: MediaVariant[];
  srcset: { webp: string; avif: string | null };
  mimeType: string;
  sizeBytes: number;
}

export interface SeoDto {
  title: string;
  description: string | null;
  canonical: string;
  robots: string;
  openGraph: { title: string; description: string | null; type: "website" | "article" | "product"; url: string; image: MediaDto | null; siteName: string; locale: string };
  twitter: { card: "summary" | "summary_large_image"; title: string; description: string | null; image: string | null; site: string | null };
  jsonLd: Record<string, unknown>[];
}

export interface CountryDto { code: string | null; name: string | null; city: string | null }

export interface MenuItemDto {
  id: UUID;
  label: string;
  href: string;
  target: "SELF" | "BLANK";
  icon: string | null;
  children: MenuItemDto[];
  viewAll?: { label: string; href: string };
}

export interface SiteDto {
  siteName: string;
  legalName: string | null;
  tagline: string | null;
  locale: string;
  logoLight: MediaDto | null;
  logoDark: MediaDto | null;
  favicon: MediaDto | null;
  appleTouchIcon: MediaDto | null;
  defaultOgImage: MediaDto | null;
  brandColors: { primary: string; accent: string; themeColor: string };
  headerCta: { enabled: boolean; label: string; hrefType: "PATH" | "TEL" | "MAILTO" | "URL"; href: string; icon: "phone" | "arrow" | "none" };
  search: { enabled: boolean; placeholder: string };
  footer: { blurb: string | null; copyright: string; credit: { enabled: boolean; prefix: string; name: string; url: string | null } };
  announcement: { text: string; linkLabel: string | null; href: string | null; variant: "INFO" | "WARNING" | "PROMO" } | null;
  maintenance: { enabled: boolean; message: string | null };
  analytics: { ga4Id: string | null; gtmId: string | null; searchConsoleVerification: string | null };
  seoDefaults: { titleTemplate: string; defaultTitle: string; defaultDescription: string | null; twitterHandle: string | null; siteNoindex: boolean };
  contactForm: { consentRequired: boolean; consentText: string | null; captchaProvider: "NONE" | "TURNSTILE" | "HCAPTCHA"; captchaSiteKey: string | null };
  social: { id: UUID; platform: "FACEBOOK" | "X" | "LINKEDIN" | "INSTAGRAM" | "YOUTUBE" | "TELEGRAM" | "TIKTOK" | "WHATSAPP"; url: string; label: string | null; showInFooter: boolean; showOnContactPage: boolean }[];
  channels: { id: UUID; type: "PHONE" | "EMAIL" | "WHATSAPP" | "FAX"; label: string | null; value: string; displayValue: string; href: string; showOnContactPage: boolean; showInFooter: boolean; showInHeader: boolean }[];
  offices: { id: UUID; name: string; isPrimary: boolean; lines: string[]; city: string; countryName: string; latitude: number | null; longitude: number | null; mapEmbedUrl: string | null; openingHours: { days: string; open: string; close: string }[] | null }[];
  menus: Record<"HEADER" | "FOOTER_QUICK" | "FOOTER_PRODUCTS" | "FOOTER_LEGAL", MenuItemDto[]>;
  uiStrings: Record<string, string>;
}

export interface MenuDto { location: string; items: MenuItemDto[] }

/* ---------- videos (amendment A6) ---------- */
export type VideoSourceType = "UPLOAD" | "YOUTUBE";
export interface VideoDto {
  id: UUID;
  title: string;
  description: string | null;
  sourceType: VideoSourceType;
  youtubeId: string | null;
  startSeconds: number | null;
  mediaUrl: string | null;
  posterUrl: string | null;
  /** Derived for YOUTUBE (hqdefault) when no poster is uploaded. */
  thumbnailUrl: string | null;
  poster: MediaDto | null;
  brand: { slug: string; name: string } | null;
  product: { slug: string; name: string } | null;
  isFeatured: boolean;
  published: boolean;
  sortOrder: number;
  durationSeconds: number | null;
  updatedAt: ISODate;
}

/* ---------- catalogue ---------- */
export interface ProductCardDto {
  id: UUID;
  slug: string;
  title: string;
  shortDescription: string;
  image: MediaDto | null;
  brand: { slug: string; name: string; logo: MediaDto | null } | null;
  category: { slug: string; name: string } | null;
  country: CountryDto;
  isFeatured: boolean;
  href: string;
}

export interface ProductDto extends ProductCardDto {
  contentHtml: string;
  tagline: string | null;
  partNumber: string | null;
  inquiryEnabled: boolean;
  gallery: { id: UUID; media: MediaDto; caption: string | null }[];
  specs: { groupName: string | null; label: string; value: string; unit: string | null }[];
  documents: { id: UUID; title: string; language: "EN" | "AM"; sizeBytes: number; downloadUrl: string }[];
  features: string[];
  related: ProductCardDto[];
  videos: VideoDto[];
  publishedAt: ISODate;
  updatedAt: ISODate;
  seo: SeoDto;
}

export interface ProductListResponse extends Paginated<ProductCardDto> {
  facets: {
    categories: { slug: string; name: string; count: number }[];
    brands: { slug: string; name: string; count: number }[];
    countries: { code: string; name: string; count: number }[];
  };
}

export interface CategoryDto {
  id: UUID; slug: string; name: string; description: string | null; image: MediaDto | null;
  parentSlug: string | null; productCount: number; children?: CategoryDto[]; seo?: SeoDto;
}

export interface BrandCardDto {
  id: UUID; slug: string; name: string; kind: "PRINCIPAL" | "PARTNER"; shortDescription: string;
  logo: MediaDto | null; logoDark: MediaDto | null; country: CountryDto; href: string;
  isExclusiveAgent: boolean;
}

export interface BrandDto extends BrandCardDto {
  descriptionHtml: string;
  heroImage: MediaDto | null;
  websiteUrl: string | null;
  videos: VideoDto[];
  products: ProductCardDto[];
  seo: SeoDto;
}

export interface ServiceCardDto {
  id: UUID; slug: string; title: string; shortDescription: string; image: MediaDto | null;
  iconName: string | null; features: { title: string; description: string | null }[]; href: string;
}

export interface ServiceDto extends ServiceCardDto {
  bodyHtml: string | null; ctaLabel: string | null; ctaHref: string | null;
  process: { step: number; title: string; text: string }[];
  relatedBrands: BrandCardDto[]; relatedProducts: ProductCardDto[];
  faqs: { id: UUID; question: string; answerHtml: string }[];
  seo: SeoDto;
}

export interface PostCardDto {
  id: UUID; slug: string; title: string; excerpt: string; cover: MediaDto | null;
  category: { slug: string; name: string } | null; authorName: string | null;
  publishedAt: ISODate; readingMinutes: number; href: string;
}
export interface PostDto extends PostCardDto {
  bodyHtml: string; tags: { slug: string; name: string }[];
  prev: PostCardDto | null; next: PostCardDto | null; related: PostCardDto[];
  updatedAt: ISODate; seo: SeoDto;
}

export interface TestimonialDto {
  id: UUID; quote: string; personName: string; personRole: string | null;
  companyName: string | null; photo: MediaDto | null; rating: number | null;
}

export interface FaqGroupDto { id: UUID; slug: string; title: string; items: { id: UUID; question: string; answerHtml: string }[]; jsonLd: Record<string, unknown> }

export interface StatDto { id: UUID; value: number; prefix: string | null; suffix: string | null; label: string; icon: string | null }
export interface TimelineEntryDto { id: UUID; yearLabel: string; title: string; descriptionHtml: string; image: MediaDto | null; icon: string | null }
export interface CoreValueDto { id: UUID; group: "MISSION" | "VALUE"; title: string; description: string | null; icon: string | null }
export interface LeaderMessageDto { id: UUID; heading: string; name: string | null; jobTitle: string | null; photo: MediaDto | null; signature: MediaDto | null; messageHtml: string }
export interface SubsidiaryDto {
  id: UUID; slug: string; name: string; legalName: string | null; countryCode: string; regionNote: string | null;
  tagline: string | null; introHtml: string; bodyHtml: string | null;
  lists: { title: string; style: "BULLETS" | "CHECKS" | "CHIPS"; items: string[] }[];
  partnerBrands: { brand: BrandCardDto; relation: "OFFICIAL_AGENT" | "EXCLUSIVE_RIGHTS" }[];
  logo: MediaDto | null; image: MediaDto | null; websiteUrl: string | null; anchorId: string;
}

/* ---------- pages and blocks ---------- */
export interface HeroSlideDto {
  id: UUID; eyebrow: string | null; heading: string; subheading: string | null; image: MediaDto | null;
  mobileImage: MediaDto | null; overlayOpacity: number; buttons: { label: string; href: string }[]; href: string | null;
}

interface BlockBase { id: UUID; type: string; anchorId: string | null; navLabel: string | null; showInTabNav: boolean; title?: string; subtitle?: string; background?: string; spacing?: string }

export type BlockDto = BlockBase & (
  | { type: "HERO_CAROUSEL"; autoplayMs: number; showThumbnails: boolean; showCounter: boolean; slides: HeroSlideDto[] }
  | { type: "BRANDS_MARQUEE"; speed: "SLOW" | "NORMAL" | "FAST"; linkToBrand: boolean; grayscale: boolean; brands: BrandCardDto[] }
  | { type: "BRAND_GRID"; columns: number; brands: BrandCardDto[] }
  | { type: "IMAGE_TEXT"; image: MediaDto | null; imagePosition: "LEFT" | "RIGHT" | "TOP"; heading: string | null; bodyHtml: string; buttons: { label: string; href: string; variant: "PRIMARY" | "SECONDARY" | "LINK"; target: "SELF" | "BLANK" }[] }
  | { type: "STATS"; stats: StatDto[] }
  | { type: "FEATURED_PRODUCTS"; layout: "GRID" | "CAROUSEL"; products: ProductCardDto[]; viewAll?: { label: string; href: string } }
  | { type: "VIDEOS_GRID"; videos: VideoDto[]; layout?: "FEATURED" | "GRID" }
  | { type: "SERVICES_GRID"; services: ServiceCardDto[]; cta?: { label: string; href: string } }
  | { type: "TESTIMONIALS"; layout: "CAROUSEL" | "GRID"; testimonials: TestimonialDto[] }
  | { type: "LATEST_POSTS"; posts: PostCardDto[] }
  | { type: "CTA_BANNER"; heading: string; text: string | null; backgroundImage: MediaDto | null; buttons: { label: string; href: string; variant: string }[] }
  | { type: "TIMELINE"; entries: TimelineEntryDto[]; orientation: "VERTICAL" | "HORIZONTAL" }
  | { type: "LEADER_MESSAGE"; leader: LeaderMessageDto | null }
  | { type: "MISSION_VISION"; missionTitle: string; visionTitle: string; visionHtml: string; missionItems: CoreValueDto[] }
  | { type: "CORE_VALUES"; values: CoreValueDto[]; layout: "CARDS" | "LIST" }
  | { type: "SUBSIDIARIES"; subsidiaries: SubsidiaryDto[]; layout: "TABS" | "STACKED" }
  | { type: "FAQ"; groups: FaqGroupDto[] }
  | { type: "RICH_TEXT"; html: string }
  | { type: "CONTACT_STRIP"; channels: SiteDto["channels"]; offices: SiteDto["offices"]; buttonLabel: string; buttonHref: string }
);

export interface PageDto {
  id: UUID; slug: string; key: "home" | "about" | null; title: string; template: "HOME" | "ABOUT" | "DEFAULT" | "LEGAL" | "LANDING";
  heroTitle: string | null; heroSubtitle: string | null; heroImage: MediaDto | null;
  blocks: BlockDto[]; tabNav: { label: string; anchorId: string }[];
  updatedAt: ISODate; seo: SeoDto;
}

/* ---------- contact, redirects, sitemap ---------- */
export interface SubmitContactDto {
  name: string; email: string; phone?: string; message: string; subject?: string;
  productSlug?: string; sourcePath?: string; consent?: boolean; website?: string;
  formStartedAt?: number; captchaToken?: string;
}
export interface SubmitContactResponse { id: UUID | null; reference: string | null; message: string }
export interface RedirectRule { source: string; target: string; type: "MOVED_301" | "FOUND_302" | "TEMP_307" | "PERM_308"; match: "EXACT" | "PREFIX" }
export interface SitemapEntry { loc: string; lastmod: ISODate; changefreq: "daily" | "weekly" | "monthly" | "yearly"; priority: number; images?: string[]; videos?: VideoDto[] }

/* ---------- auth and admin ---------- */
export interface MeDto { id: UUID; email: string; name: string; role: "ADMIN"; avatar: MediaDto | null; mustChangePassword: boolean; twoFactorEnabled: boolean; csrfToken: string }
export interface SessionDto { id: UUID; deviceLabel: string | null; ip: string | null; createdAt: ISODate; lastUsedAt: ISODate; current: boolean }
export interface MessageListItemDto { id: UUID; reference: string; name: string; email: string; phone: string | null; excerpt: string; status: "NEW" | "READ" | "REPLIED" | "ARCHIVED" | "SPAM"; isStarred: boolean; productTitle: string | null; createdAt: ISODate }
export interface MessageDto extends Omit<MessageListItemDto, "excerpt"> {
  message: string; subject: string | null; sourcePath: string | null; ip: string | null; userAgent: string | null;
  spamScore: number; spamReasons: string[]; notificationStatus: "PENDING" | "SENT" | "FAILED";
  notes: { id: UUID; kind: "NOTE" | "REPLY"; body: string; author: { id: UUID; name: string } | null; createdAt: ISODate }[];
  readAt: ISODate | null; repliedAt: ISODate | null;
}
export interface AuditLogDto { id: string; action: string; entityType: string | null; entityId: string | null; summary: string; diff: Record<string, [unknown, unknown]> | null; actorEmail: string | null; ip: string | null; createdAt: ISODate }
export interface RevisionDto { id: UUID; versionNo: number; changeNote: string | null; author: { id: UUID; name: string } | null; createdAt: ISODate }
export interface AdminWarning { code: string; message: string; field?: string }
export interface DashboardDto {
  counts: Record<string, { total: number; published?: number; draft?: number; scheduled?: number }>;
  messages: { new: number; total: number; last7d: number[] };
  recentMessages: MessageListItemDto[];
  recentActivity: AuditLogDto[];
  upcomingScheduled: { entityType: string; id: UUID; title: string; scheduledAt: ISODate }[];
  health: { db: "ok" | "failing"; storage: "ok" | "failing"; mail: "unconfigured"; jobsBacklog: number; lastRevalidation: { status: string; at: ISODate } | null };
  warnings: { missingImages: { entityType: string; id: UUID; title: string }[]; missingSeoDescription: number; unusedMedia: number; draftOlderThan30d: number; socialLinksMissing: boolean };
}
