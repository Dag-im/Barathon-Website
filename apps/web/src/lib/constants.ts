/** Fixed site constants. The developer credit is intentionally not CMS-editable. */
export const DEVELOPER_CREDIT = {
  text: "Developed by",
  name: "Dagim Meseret",
} as const;

/** Slugs that generic CMS pages may never take (plan 4.8). */
export const RESERVED_SLUGS = [
  "admin", "api", "about", "products", "brands", "services", "news", "contact",
  "search", "faq", "thank-you", "sitemap", "robots", "manifest", "_next", "favicon",
  "static", "login", "sitemap.xml", "robots.txt", "manifest.webmanifest",
] as const;

export const PAGE_SIZES = { products: 12, news: 9, brands: 48, search: 10 } as const;

export const ADMIN_BASE = "/admin";

export const ACCESS_COOKIES = ["bt_at", "__Host-bt_at", "bt_rt", "__Secure-bt_rt"] as const;
export const CSRF_COOKIES = ["bt_csrf", "__Secure-bt_csrf"] as const;
