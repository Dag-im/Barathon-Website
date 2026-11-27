/** Lowercase ASCII slug with accents folded (backend-plan 3.3). */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
    .replace(/-+$/, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'about', 'products', 'product', 'brands', 'brand', 'services', 'service',
  'news', 'contact', 'search', 'media', '_next', 'sitemap', 'robots', 'favicon', 'login', '404',
  'preview', 'videos', 'video',
]);
