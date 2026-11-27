import "server-only";
import { cache } from "react";
import { apiRequest } from "./client";
import { TAGS } from "./tags";
import type {
  BrandDto, CategoryDto, FaqGroupDto, MenuDto, PageDto, Paginated, PostCardDto, PostDto,
  ProductDto, ProductListResponse, ProductCardDto, RedirectRule, ServiceDto, ServiceCardDto,
  SitemapEntry, SiteDto, SubmitContactDto, SubmitContactResponse, TestimonialDto, VideoDto, BrandCardDto,
} from "./types";

/**
 * Public read layer. Every fetcher is deduplicated per request with React
 * cache() and tagged for on-demand revalidation (plan 4.3, backend 6.1.7).
 * These run only on the server; client components receive plain props.
 */

const ISR = { revalidate: 3600 as const };
type Q = Record<string, string | number | boolean | null | undefined>;

export const getSite = cache(() =>
  apiRequest<SiteDto>("/public/site", { next: { tags: [TAGS.site, TAGS.menus], revalidate: 3600 } }),
);

export const getPage = cache((slug: string) =>
  apiRequest<PageDto>(`/public/pages/${encodeURIComponent(slug)}`, { next: { tags: [TAGS.page(slug), TAGS.pages], revalidate: 86400 } }),
);

export const getPageSummaries = cache(() =>
  apiRequest<{ data: { slug: string; title: string; updatedAt: string }[] }>("/public/pages", { next: { tags: [TAGS.pages], revalidate: 3600 } }),
);

export const getProducts = cache((query: Q) =>
  apiRequest<ProductListResponse>("/public/products", { query, next: { tags: [TAGS.products], revalidate: 600 } }),
);

export const getProduct = cache((slug: string) =>
  apiRequest<ProductDto>(`/public/products/${encodeURIComponent(slug)}`, { next: { tags: [TAGS.product(slug), TAGS.products], revalidate: 3600 } }),
);

export const getProductCategories = cache(() =>
  apiRequest<{ data: CategoryDto[] }>("/public/product-categories", { next: { tags: [TAGS.categories], revalidate: 3600 } }),
);

export const getCategory = cache((slug: string) =>
  apiRequest<CategoryDto>(`/public/product-categories/${encodeURIComponent(slug)}`, { next: { tags: [TAGS.categories], revalidate: 3600 } }),
);

export const getBrands = cache((query: Q = {}) =>
  apiRequest<Paginated<BrandCardDto>>("/public/brands", { query, next: { tags: [TAGS.brands], revalidate: 3600 } }),
);

export const getBrand = cache((slug: string) =>
  apiRequest<BrandDto>(`/public/brands/${encodeURIComponent(slug)}`, { next: { tags: [TAGS.brand(slug), TAGS.brands], revalidate: 3600 } }),
);

export const getServices = cache(() =>
  apiRequest<{ data: ServiceCardDto[] }>("/public/services", { next: { tags: [TAGS.services], revalidate: 3600 } }),
);

export const getService = cache((slug: string) =>
  apiRequest<ServiceDto>(`/public/services/${encodeURIComponent(slug)}`, { next: { tags: [TAGS.service(slug), TAGS.services], revalidate: 3600 } }),
);

export const getVideos = cache((query: Q = {}) =>
  apiRequest<Paginated<VideoDto>>("/public/videos", { query, next: { tags: [TAGS.videos], revalidate: 3600 } }),
);

export const getTestimonials = cache(() =>
  apiRequest<{ data: TestimonialDto[] }>("/public/testimonials", { next: { tags: [TAGS.testimonials], revalidate: 3600 } }),
);

export const getFaqs = cache((group?: string) =>
  apiRequest<{ data: FaqGroupDto[] }>("/public/faqs", { query: { group }, next: { tags: [TAGS.faqs], revalidate: 3600 } }),
);

export const getPosts = cache((query: Q = {}) =>
  apiRequest<Paginated<PostCardDto>>("/public/posts", { query, next: { tags: [TAGS.posts], revalidate: 600 } }),
);

export const getPost = cache((slug: string) =>
  apiRequest<PostDto>(`/public/posts/${encodeURIComponent(slug)}`, { next: { tags: [TAGS.post(slug), TAGS.posts], revalidate: 600 } }),
);

export const searchSite = cache((q: string, types?: string) =>
  apiRequest<{ products: ProductCardDto[]; brands: BrandCardDto[]; services: ServiceCardDto[]; posts: PostCardDto[]; pages: { slug: string; title: string; href: string }[] }>(
    "/public/search",
    { query: { q, types, limit: 10 }, cache: "no-store" },
  ),
);

export const submitContact = (body: SubmitContactDto) =>
  apiRequest<SubmitContactResponse>("/public/contact", { method: "POST", body, noRefresh: true, cache: "no-store" });

export const getRedirects = cache(() =>
  apiRequest<{ data: RedirectRule[] }>("/public/redirects", { next: { tags: [TAGS.redirects], revalidate: 300 } }),
);

export const resolveRedirect = (path: string) =>
  apiRequest<{ match: false } | { match: true; target: string; type: RedirectRule["type"] }>("/public/redirects/resolve", {
    query: { path },
    cache: "no-store",
  });

export const getSitemapEntries = cache(() =>
  apiRequest<{ data: SitemapEntry[] }>("/public/sitemap", { next: { tags: [TAGS.sitemap], revalidate: 300 } }),
);

export const getSlugs = cache((type: "products" | "brands" | "services" | "posts" | "pages" | "categories") =>
  apiRequest<{ data: { slug: string; updatedAt: string }[] }>(`/public/slugs/${type}`, { next: { tags: [TAGS.sitemap], revalidate: 3600 } }),
);

export const getMenus = cache(() =>
  apiRequest<{ data: MenuDto[] }>("/public/menus", { next: { tags: [TAGS.menus], revalidate: 3600 } }),
);

export const ISR_DEFAULT = ISR;
