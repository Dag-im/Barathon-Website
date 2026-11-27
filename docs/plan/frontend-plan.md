# Barathon Trading - Frontend Plan (apps/web)

Status: planning document. No application code is contained here. The visual design (colors, typography, look and feel) is specified in a separate design document; this plan covers architecture, pages, components, data flow, SEO and the admin CMS UI.

Audience: the engineer implementing `apps/web`. Everything here is meant to be literal: route paths, file names, component names, props and field lists are normative. Where the design spec and this plan disagree on visuals, the design spec wins; where they disagree on structure or behaviour, this plan wins.

---

## 0. Source material findings (what the live site tells us)

Observed from `docs/source/*`:

- Live site routes: `/`, `/about`, `/products`, `/product/:id`, `/service`, `/contact`, a company (brand) detail page (typo'd path `/comapny/:id` is possible), admin screens.
- Navigation: Home, About Us, Products (dropdown listing products), Service, Contact Us. Header has a product search box and a "Let's Talk" CTA with phone icon.
- Home: hero carousel of products (counter "1/8", thumbnails strip), "Brands We Work With" logo marquee ("Trusted by industry leaders worldwide"), company story block with logo and buttons "Learn more" and "Our Products", Featured Videos ("Discover our work through these immersive experiences", 6 YouTube embeds), Our Services.
- Products grid: card with image, country badge, share icon, title, short description, "Read More". Product detail renders markdown (headings, bold, lists, images).
- Data model in the live JSON:
  - Product: `title, shortDescription, image, country, content(markdown), createdAt`. 8 products: FURUKAWA Rock Drills (Japan), Air Compressor (Japan), Montabert (France), Monark (Ockelbo, Sweden), Carmix (Italy), Elsasser (Germany), Walter (Germany), Nakayama crushers (Japan).
  - Company (brand): `logo_image, company_name, company_short_discription, company_youtubeLink, company_description, company_country`. 9 companies: Nakayama, Sumitomo Construction Machinery Co. Ltd, Montabert, Elsasser, Monark, Walter Geratebou, Carmix, Furukawa Rock Drill Co, AIRMAN. Data is dirty: country values like "Tokyo,Japan", "sweden", "Saitama, Japan"; one YouTube link is the literal string `a`; links come as `watch?v=` or `embed/` with `&t=`/`?si=` params. The importer must normalise these (see 12.4).
  - Service: `title, shortDescription, image, contentList[]`. 2 services: Parts and Accessories, Maintenance and Service (typo "redictive" in the live data, to be corrected on import).
- Images are on Cloudinary today; they move to MinIO. Many hero/brand images are broken on the live site, so every image slot MUST have a graceful fallback (neutral placeholder block with brand mark) and the CMS must flag missing images.
- Footer: logo, blurb, socials (4 icons), Quick Links, Our Products (first 5), Contact Us (Bole Road, Wollo Sefer, Addis Ababa, Ethiopia, P.O.Box 62716; +251 911 514558, +251 911 175644, +251 114 709133; aboma.taye@gmail.com), copyright. Credit must read "Developed by Dagim Meseret".
- Old admin: login, forgot password, reset password, CRUD for products, services, companies, message inbox with detail pane ("Select a message").
- Copy (CEO message, mission, vision, values, two subsidiaries text, About text) is in `ui-strings.txt` and must be seeded into CMS content, not hard-coded in components.

---

## 1. Goals, scope, non-goals

### 1.1 Goals
1. A fast, fully SEO-optimised public marketing site for Barathon Trading / Baraton Group Co. that keeps the live site's content format (home, about, products, brands, services, contact) and extends it with news, FAQ, testimonials, generic pages and search.
2. A single-admin CMS at `/admin` through which essentially all text, images, navigation, homepage sections, SEO metadata, redirects, robots and analytics IDs are editable without a deploy.
3. Clean contract with the NestJS API (`/api/v1`), typed end to end from the OpenAPI spec.
4. Deployable as a Docker container on a VPS behind a reverse proxy.
5. Lighthouse >= 95 on Performance/Accessibility/Best Practices/SEO for all public templates on mobile.

### 1.2 Non-goals (v1)
- No public user accounts, no shopping cart, no online payment, no price display (this is a quote/inquiry business).
- No multi-role RBAC (one Admin user type). Permissions UI is limited to "admin only".
- No live chat, no marketplace features.
- No full i18n content in v1 (English only) but all code is i18n-ready (section 2.12).
- No native mobile app. PWA install is not required (manifest only for icons/theme).
- No page-builder with free-form drag of arbitrary HTML; only ordered, typed section blocks.

### 1.3 Business facts used in code and seed
- Brand names: Public brand "Baraton Group Co."; platform name "Barathon Trading". Site name used in titles is configurable (Site Settings `siteName`), seed default: "Baraton Group Co.". Keep the spelling variants configurable; do not hard-code.
- Subsidiaries: Baraton Trade PLC (Ethiopia; official agent of Furukawa Rock Drill and Airman) and Baraton Trade LLC (Florida, USA).

---

## 2. Tech stack decisions and versions

Pin exact versions in `package.json` (caret ranges allowed only for patch); lockfile committed (pnpm).

| Concern | Decision | Version target | Notes |
|---|---|---|---|
| Package manager / monorepo | pnpm workspaces (+ Turborepo optional) | pnpm 9.x | root `pnpm-workspace.yaml`: `apps/*`, `packages/*` |
| Runtime | Node.js LTS | 22.x | Docker base `node:22-alpine` |
| Framework | Next.js App Router | 15.x (latest stable at start; do not use Pages Router) | `output: 'standalone'` for Docker |
| UI lib | React | 19.x | Server Components by default |
| Language | TypeScript strict | 5.6+ | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` off |
| Styling | Tailwind CSS | 4.x (if shadcn CLI supports; else 3.4) | tokens come from design spec via CSS variables in `app/globals.css` |
| Component kit | shadcn/ui (CLI-installed into `components/ui`) | latest CLI | Radix primitives underneath |
| Forms | react-hook-form 7 + zod 3/4 + `@hookform/resolvers` | | shared zod schemas in `packages/shared` when the backend uses the same |
| Server state (admin) | TanStack Query v5 | | admin only; public site uses RSC fetch |
| Tables (admin) | TanStack Table v8 | | wrapped by `components/admin/DataTable` |
| Drag and drop | dnd-kit (`@dnd-kit/core`, `sortable`, `utilities`) | | nav editor, homepage builder, gallery order, specs order |
| Rich text editor | Tiptap v2 (StarterKit, Link, Image, Table, Placeholder, CharacterCount, Youtube, Underline, TextAlign, Heading levels 2-4) | | stores **Markdown** as source of truth + sanitized HTML cache? Decision below |
| Markdown/rich-text rendering | `react-markdown` + `remark-gfm` + `rehype-sanitize` + `rehype-slug` + `rehype-autolink-headings` | | the API stores Markdown (matches live `content` field). Tiptap uses `tiptap-markdown` extension to import/export Markdown. |
| Image handling | `next/image` with remote patterns for MinIO host | | custom `loader` NOT used in v1; Next optimizer in the container (sharp installed) |
| Motion | `motion` (Framer Motion successor, package `motion/react`) | 11/12 | only in client leaf components; respect `prefers-reduced-motion` |
| Carousel | shadcn `carousel` (Embla) + `embla-carousel-autoplay` | | hero + testimonials + related products |
| Marquee | CSS-only keyframes (no JS lib) | | pause on hover/focus, disabled under reduced motion |
| Icons | `lucide-react` | | plus inline SVG for brand social icons (lucide dropped brand icons); keep in `components/icons/social.tsx` |
| Fonts | `next/font` (Google or local) | | exact families set in design spec; the plan only mandates `next/font`, `display: swap`, variable fonts, max 2 families, preload only the primary |
| Toasts | shadcn `sonner` | | single `<Toaster/>` in root layouts |
| Dates | `date-fns` | | |
| Charts (dashboard) | shadcn `chart` (Recharts) | | admin dashboard only, dynamic import |
| HTTP | native `fetch` wrapped by `lib/api`; OpenAPI types by `openapi-typescript` + `openapi-fetch` | | generated into `lib/api/schema.d.ts` |
| Sanitization | `isomorphic-dompurify` for any HTML snippets (embed codes are NOT accepted; map is structured) | | |
| reCAPTCHA / captcha | Cloudflare Turnstile slot (`@marsidev/react-turnstile`), provider selectable by env/CMS: `none | turnstile | recaptcha-v3` | | |
| Analytics | GA4 + GTM + Search Console verification via CMS-configured IDs; loaded with `next/script` `afterInteractive` (GTM) / `lazyOnload`; consent-gated | | section 5.13 |
| Testing | Vitest + React Testing Library, MSW for API mocks, Playwright (e2e + a11y via `@axe-core/playwright`), Lighthouse CI | | |
| Lint/format | ESLint (next/core-web-vitals, jsx-a11y, tailwindcss plugin, import/order), Prettier, `tsc --noEmit`, lint-staged + husky | | |
| Env validation | `@t3-oss/env-nextjs` + zod | | fails build on missing vars |

### 2.1 shadcn/ui components to install (exact list)
Install into `apps/web/components/ui` via `npx shadcn@latest add ...`:

`accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu(optional skip), dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, navigation-menu, pagination, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip`.

Usage map: `navigation-menu` (desktop mega-menu), `sheet` (mobile nav, admin mobile sidebar, filter drawer), `command` (search palette and admin quick-jump Ctrl/Cmd+K), `dialog`/`alert-dialog` (confirm delete, image picker, restore revision), `drawer` (mobile filters/bottom sheets), `sidebar` (admin shell), `breadcrumb`, `pagination`, `table` (+TanStack), `tabs` (product detail, admin forms), `accordion` (FAQ), `carousel` (hero, testimonials), `badge` (country, status), `sonner` (toasts), `skeleton` (loading), `input-otp` (2FA), `calendar`+`popover` (publish scheduling date picker), `chart` (dashboard), `progress` (upload), `switch` (toggles), `slider` (crop zoom), `toggle-group` (view mode grid/list).

### 2.2 Editor decision
- Source of truth stored by the API for rich fields: **Markdown string** (field name `bodyMarkdown`/`content`). Reason: matches existing data, diff-friendly in revisions, safe to render.
- CMS editor: Tiptap with `tiptap-markdown` to load/emit Markdown. Toolbar: H2/H3/H4, bold, italic, underline(not in MD: disabled), link, bullet/ordered list, blockquote, table (GFM), image (opens Media Library dialog, inserts `![alt](url)`), YouTube embed (inserted as a Markdown directive `::youtube{id=XXXX}` handled by renderer), horizontal rule, code block off. Toggle "Source" tab shows raw Markdown textarea (for pasting legacy content such as `#### ##### ...`).
- Renderer: `components/content/Markdown.tsx` (server component) maps headings/images/links to design-system components, adds `rel="noopener noreferrer"` + `target=_blank` for external links, uses `next/image` for images with known MinIO host (else plain `<img loading=lazy>` with width/height unknown handled by `aspect-ratio` wrapper), and demotes heading levels: content `#` renders as `h2` because the page title owns `h1` (rule in 5.9). Legacy `\r\n` normalised.

### 2.3 Image handling rules
- `next.config.ts` `images.remotePatterns` built from env `NEXT_PUBLIC_MEDIA_BASE_URL` (e.g. `https://media.<domain>/barathon/**`) and dev `http://localhost:9000/**`. `formats: ['image/avif','image/webp']`, `deviceSizes` default, `minimumCacheTTL: 31536000` (media URLs are immutable/hash-versioned by API).
- Every image object from API: `{ id, url, width, height, alt, blurDataURL?, focalPoint:{x,y}?, mimeType }`. `components/media/CmsImage.tsx` wraps `next/image`, passes `width/height` (no CLS), `sizes` prop REQUIRED by the caller, `placeholder="blur"` when `blurDataURL` exists, `style objectPosition` from focalPoint, fallback component on error (client boundary only for the error handler; use `<picture>`-free approach).
- LCP image on each page gets `priority` and `fetchPriority="high"`; everything else lazy.
- SVG logos use `unoptimized` (served directly).

### 2.4 i18n readiness
- Not shipping multi-language in v1, but: all UI chrome strings in `messages/en.json`, accessed through `lib/i18n/t.ts` (`getMessages()` server, `useMessages()` client) - a thin wrapper that can be swapped for `next-intl` later. All CMS entities carry `locale` in API shape (default `en`). Public routes are NOT prefixed in v1; the folder structure keeps `app/(public)/` so that `app/(public)/[locale]/` can be introduced later. `<html lang>` from `settings.defaultLocale`. hreflang plan in 5.10.

### 2.5 Browser support
Last 2 versions of Chrome, Edge, Firefox, Safari (iOS 16+), Samsung Internet. No IE. `browserslist` in package.json. Progressive enhancement: public pages are fully usable without JS except carousel autoplay, search palette, and contact form submit (form also works via native POST fallback? Decision: no; use Server Action with progressive enhancement via `<form action>` so it works without JS).

---

## 3. Repository and folder structure (apps/web)

Monorepo layout (frontend-owned parts marked):

```
/home/user/Barathon-Website
  apps/
    web/            <- THIS PLAN
    api/            <- NestJS (other plan)
  packages/
    shared/         <- (optional) zod schemas + constants shared by web and api
    api-client/     <- (optional) generated OpenAPI types; if absent, generated inside apps/web/lib/api
  docs/
  docker/
  package.json, pnpm-workspace.yaml, turbo.json
```

### 3.1 apps/web tree (normative)

```
apps/web/
  next.config.ts
  tailwind.config.ts (if TW3) / app/globals.css (tokens placeholders; values from design spec)
  components.json                      shadcn config
  middleware.ts                        admin cookie gate + redirects hook (see 4.7)
  instrumentation.ts                   (optional) error reporting
  messages/en.json
  public/
    favicon fallbacks, manifest fallbacks, placeholder images (/placeholders/*.svg)
  scripts/
    gen-api.ts                         openapi-typescript runner
    check-env.ts
  e2e/                                 Playwright specs
  src/
    app/
      layout.tsx                       root: <html>, fonts, providers-less, JSON-LD Organization/WebSite (via component), analytics scripts
      globals.css
      not-found.tsx                    global 404 (consults redirects, see 4.6)
      global-error.tsx
      robots.ts                        dynamic, from /public/settings/robots
      sitemap.ts                       sitemap index via generateSitemaps()
      manifest.ts
      opengraph-image.tsx              default site OG image
      icon.tsx? (not used; favicons from CMS served through route handlers below)
      (public)/
        layout.tsx                     Header, Footer, SkipLink, JSON-LD site-wide, PreviewBanner, Command palette provider
        page.tsx                       Home (/)
        loading.tsx, error.tsx
        about/page.tsx
        products/
          page.tsx                     list (searchParams: q, country, category, page, sort)
          loading.tsx
          [slug]/page.tsx              detail
          [slug]/opengraph-image.tsx
          category/[categorySlug]/page.tsx
        brands/
          page.tsx
          [slug]/page.tsx
          [slug]/opengraph-image.tsx
        services/
          page.tsx
          [slug]/page.tsx
          [slug]/opengraph-image.tsx
        news/
          page.tsx
          page/[page]/page.tsx         (optional crawlable pagination; decision: use ?page=N with canonical self, see 5.8)
          [slug]/page.tsx
          [slug]/opengraph-image.tsx
          tag/[tagSlug]/page.tsx
        contact/page.tsx
        search/page.tsx                (noindex)
        faq/page.tsx
        [slug]/page.tsx                generic CMS page (privacy-policy, terms) - MUST be last/lowest precedence
        thank-you/page.tsx             (noindex) contact success (optional, used for conversion tracking)
      (admin)/
        admin/
          layout.tsx                   AdminShell (sidebar, topbar), QueryProvider, Toaster, noindex metadata
          (auth)/
            login/page.tsx
            forgot-password/page.tsx
            reset-password/page.tsx    (?token=)
            layout.tsx                 centered auth layout, no sidebar
          (dashboard)/
            layout.tsx                 requires session (server check + client guard)
            page.tsx                   Dashboard (/admin)
            settings/page.tsx          Site Settings (tabs)
            navigation/page.tsx        Navigation & Footer
            homepage/page.tsx          Homepage builder
            pages/page.tsx, pages/new/page.tsx, pages/[id]/page.tsx
            about/page.tsx
            products/page.tsx, products/new/page.tsx, products/[id]/page.tsx, products/categories/page.tsx
            brands/page.tsx, brands/new, brands/[id]
            services/page.tsx, services/new, services/[id]
            videos/page.tsx
            testimonials/page.tsx
            faq/page.tsx
            news/page.tsx, news/new, news/[id], news/categories (tags managed inline)
            media/page.tsx
            messages/page.tsx, messages/[id]/page.tsx
            seo/page.tsx                (tabs: Overview, Redirects, Robots & Sitemap, Analytics & Tags)
            seo/redirects/page.tsx
            revisions/page.tsx          (global history; per-entity history is a drawer)
            account/page.tsx            (profile, password, sessions, 2FA)
            audit-log/page.tsx
      api/
        revalidate/route.ts            POST webhook from NestJS (HMAC secret)
        preview/route.ts               GET enable draft mode (token), 
        preview/exit/route.ts          GET disable draft mode
        health/route.ts                GET 200 for Docker healthcheck
        favicon/route.ts? (see 5.14)   serves CMS favicon sizes
        media-proxy? NOT used
    components/
      ui/                              shadcn generated (do not hand-edit except tokens)
      layout/                          SiteHeader, MegaMenu, MobileNav, SearchCommand, SiteFooter, SkipLink, Breadcrumbs, PreviewBanner, CookieConsent
      sections/                        homepage/page blocks (section 7.3)
      content/                         Markdown, RichText, VideoEmbed, ShareButton, SpecTable, StatCounter, Prose
      media/                           CmsImage, Gallery, Lightbox, LogoMarquee, VideoFacade
      products/                        ProductCard, ProductGrid, ProductFilters, ProductGallery, ProductSpecs, InquiryButton, RelatedProducts
      brands/                          BrandCard, BrandGrid, BrandHero
      services/                        ServiceCard
      news/                            PostCard, PostMeta, TagList
      forms/                           ContactForm, InquiryFields, Honeypot, CaptchaSlot, NewsletterForm(optional)
      seo/                             JsonLd, seo helpers are in lib/seo
      admin/                           (section 8.2) AdminShell, DataTable, EntityForm, SeoPanel, MediaPicker, RichTextEditor, SortableList, ConfirmDialog, StatusBadge, PublishBar, RevisionDrawer, UnsavedGuard, ...
    lib/
      api/
        client.ts                      openapi-fetch instances: publicClient (server), adminClient (browser)
        schema.d.ts                    GENERATED, committed
        public.ts                      typed server fetchers: getSettings(), getHome(), getProducts()...
        admin.ts                       typed client hooks factories used by TanStack Query
        errors.ts                      ApiError class, problem-details parser
        tags.ts                        cache tag constants
      auth/
        session.ts                     server: readSession() calls /admin/auth/me with forwarded cookie
        client.ts                      client: refresh-on-401 queue
      seo/
        metadata.ts                    buildMetadata(entity, defaults)
        jsonld.ts                      builders (organization, website, product, ...)
        urls.ts                        absoluteUrl(), canonical()
      i18n/t.ts
      utils/ (cn.ts, format.ts, slug.ts, youtube.ts, url.ts, phone.ts)
      validation/ (zod schemas: contact.ts, product.ts, ... mirrors API)
      env.ts
      constants.ts                     route map, revalidate times, page sizes
    hooks/ (useDebounce, useUnsavedChanges, useMediaQuery, useHotkey)
    providers/ (QueryProvider, ThemeProvider (if design requires), ConsentProvider)
    types/ (domain types re-exported from schema.d.ts, e.g. Product = components['schemas']['ProductPublic'])
    styles/ (prose.css if needed)
```

Rules:
- `components/ui` is generated; wrappers go elsewhere.
- Path alias `@/*` -> `src/*`.
- One component per file, PascalCase file names for components, kebab-case for route folders, `use-*.ts`/camelCase for hooks.
- No barrel files except `components/sections/index.ts` (registry).

### 3.2 Server vs client boundaries
- Default = Server Component. `"use client"` only for: `MobileNav`, `SearchCommand`, `ProductFilters` (URL-driven, can be mostly server forms), `HeroCarousel`, `TestimonialsCarousel`, `ShareButton`, `ContactForm` (RHF), `Lightbox`, `VideoFacade` (click to load iframe), `CookieConsent`, `StatCounter` (animated), all of `components/admin/*` interactive pieces and all admin pages' form areas.
- Data fetching for public pages occurs only in server components/route handlers/`generateMetadata`. Public client components receive plain props (serialisable).
- Admin pages: page.tsx server component only does the auth check and renders a client "screen" component (`<ProductsScreen/>`) that uses TanStack Query against `/api/v1/admin/*`.
- Browser calls to the API go cross-origin-free through a Next rewrite: `/api/v1/*` -> `${API_INTERNAL_URL}/api/v1/*` (see 3.3) so httpOnly cookies are first party. Server-side fetches use `API_INTERNAL_URL` (docker network) directly.

### 3.3 Environment variables (validated in `lib/env.ts`)

| Var | Scope | Example | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | `https://baratongroup.com` | canonical origin, sitemap, OG |
| `NEXT_PUBLIC_API_BASE_PATH` | public | `/api/v1` | browser calls (proxied by rewrite) |
| `API_INTERNAL_URL` | server | `http://api:3001` | SSR/ISR fetches and rewrite target |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | public | `https://media.baratongroup.com` | image remote pattern, absolute URLs |
| `REVALIDATE_SECRET` | server | long random | HMAC verify for `/api/revalidate` |
| `PREVIEW_SECRET` | server | long random | verify preview token from API |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public | | captcha slot (optional) |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | public | `en` | |
| `NEXT_PUBLIC_ENABLE_INDEXING` | public | `true`/`false` | `false` on staging forces noindex + robots disallow regardless of CMS |
| `NODE_ENV`, `PORT`, `HOSTNAME` | server | | |
| `SENTRY_DSN` (optional) | server/public | | error reporting hook |

GA4/GTM/GSC IDs are NOT env vars; they come from CMS settings (5.13).

`next.config.ts` must define: `output: 'standalone'`, `images.remotePatterns`, `rewrites()` for `/api/v1/:path*`, `headers()` (security headers: `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN` except nothing embeds us, CSP report-only first then enforced; admin routes add `X-Robots-Tag: noindex, nofollow`), `poweredByHeader: false`, `experimental.optimizePackageImports: ['lucide-react','date-fns']`, `typedRoutes: true`.

---

## 4. Rendering and data strategy

### 4.1 Principles
- Public pages are statically generated and revalidated on demand (ISR with tags) so TTFB is CDN-grade; a time-based fallback revalidate protects against missed webhooks.
- Single data-access layer `lib/api/public.ts`; every fetcher is wrapped with `cache()` (React) for request dedupe and passes `{ next: { tags: [...], revalidate: N } }`.
- Draft mode (preview) bypasses cache: fetchers read `draftMode().isEnabled` and then send `?preview=1` + preview token header and `cache: 'no-store'`.

### 4.2 Per-route strategy

| Route | Strategy | Tags | Fallback revalidate | Notes |
|---|---|---|---|---|
| `/` | SSG + ISR | `home`, `settings`, `products`, `brands`, `services`, `videos`, `news`, `testimonials` | 3600 s | sections resolved server-side from `GET /public/home` (sections array already expanded by API where possible) |
| `/about` | SSG + ISR | `about`, `settings` | 86400 | |
| `/products` | SSR-ish ISR: static shell for the unfiltered list; `searchParams` makes it dynamic -> use dynamic rendering with fetch cache tags (`products`) | `products`, `product-categories` | 600 | filtered URLs `noindex,follow` + canonical to `/products` (5.8) |
| `/products/[slug]` | SSG (`generateStaticParams` all published slugs) + ISR, `dynamicParams = true` | `product:{slug}`, `products` | 3600 | `notFound()` if API 404 |
| `/products/category/[categorySlug]` | SSG + ISR | `product-category:{slug}`, `products` | 3600 | indexable |
| `/brands`, `/brands/[slug]` | SSG + ISR | `brands`, `brand:{slug}` | 3600 | |
| `/services`, `/services/[slug]` | SSG + ISR | `services`, `service:{slug}` | 3600 | |
| `/news`, `/news/[slug]`, `/news/tag/[tagSlug]` | SSG + ISR | `news`, `post:{slug}`, `tag:{slug}` | 600 | |
| `/faq` | SSG + ISR | `faq` | 3600 | |
| `/contact` | SSG shell + client form + Server Action | `contact`, `settings` | 86400 | prefill reads `searchParams` (`?product=slug&subject=`) client-side via `useSearchParams` inside Suspense so the page stays static |
| `/search` | dynamic SSR (`searchParams.q`) | none (`no-store` for API search) | n/a | `robots: noindex,follow` |
| `/[slug]` | SSG + ISR | `page:{slug}` | 86400 | reserved slug list in 4.8 |
| `/thank-you` | static | | | noindex |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | route handlers, ISR | `sitemap`, `robots`, `settings` | 3600 / 3600 / 86400 | |
| `/admin/**` | fully dynamic, client-rendered data, `export const dynamic = 'force-dynamic'`, `robots noindex` | none | | |

### 4.3 Fetch caching tags (constants in `lib/api/tags.ts`)
`settings, navigation, home, about, products, product:{slug}, product-categories, product-category:{slug}, brands, brand:{slug}, services, service:{slug}, news, post:{slug}, tag:{slug}, faq, testimonials, videos, page:{slug}, redirects, robots, sitemap`.

### 4.4 On-demand revalidation webhook
- Endpoint: `POST /api/revalidate` (Next route handler). Called by NestJS after any publish/update/delete.
- Request: headers `X-Signature: sha256=<hex HMAC of raw body using REVALIDATE_SECRET>`, `X-Timestamp` (reject if older than 5 min). Body: `{ "tags": ["product:furukawa-rock-drills","products","sitemap"], "paths": ["/products/furukawa-rock-drills"] }`.
- Behaviour: verify HMAC (timing-safe) -> for each tag `revalidateTag(tag)`, for each path `revalidatePath(path)` -> `200 {revalidated:true, now}`; invalid signature `401`; malformed `400`.
- API-side contract: the API decides tags; the frontend does not infer. Suggested mapping the backend must follow is in section 11.3.
- Also revalidated on settings change: tag `settings` (header/footer/metadata consumers) - every page uses `settings`, so it triggers a broad refresh; acceptable (rare event).

### 4.5 Loading / error / not-found states
- `loading.tsx` at `(public)` level and at `products/`, `news/`, `search/` showing skeletons matching final layout (CLS safe).
- `error.tsx` (client) at `(public)` and `(admin)/admin`: friendly message, "Try again" (`reset()`), contact link, error digest displayed small. `global-error.tsx` for root layout failures (minimal static HTML, no API).
- `not-found.tsx`: global, branded 404 with search box, popular links (Products, Brands, Contact) and status 404. `notFound()` called from entity pages when API returns 404.
- API down at build time: `generateStaticParams` returns `[]` on failure and pages render on demand; builds must not fail because the API is offline (guard with try/catch + log).
- API down at runtime for ISR: Next serves the stale page; new fetch failures throw -> error boundary only for uncached dynamic routes.

### 4.6 404 handling with CMS redirects
Two layers:
1. **Edge-fast layer (middleware)**: not used for the full redirect table (middleware runs on every request and cannot cheaply fetch). Middleware only handles static legacy patterns compiled at build in `lib/redirects/legacy.ts` (e.g. `/product/:id`, `/comapny/:id` handled by lookup since ids are Mongo ObjectIds -> mapped by the API; see 5.11).
2. **CMS redirects table**: `GET /public/redirects` returns `[{from,to,statusCode,isRegex}]`. `next.config.ts` `redirects()` loads them at **build and server start** (async function, cached; falls back to `[]`), plus runtime handling: in `not-found.tsx` (server) the requested path is read from the `x-pathname` header set by middleware; the component calls `GET /public/redirects/resolve?path=` and, if matched, `redirect(to)` / `permanentRedirect(to)`. This guarantees redirects created in the CMS work immediately without redeploy. Result cached with tag `redirects` and revalidated by webhook.
3. Redirect rules validation in admin prevents loops (8.12).

### 4.7 Middleware (`middleware.ts`)
Matcher: `['/admin/:path*', '/((?!_next|api|.*\\..*).*)']` minimal. Responsibilities:
- Set `x-pathname` request header for not-found resolution.
- `/admin/**` (except `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`): if no session cookie present (cookie name from API contract: `bt_access` and `bt_refresh`; the middleware checks only presence of `bt_refresh` or `bt_access`) -> redirect `307` to `/admin/login?next=<encoded path+query>`. Cookie *validity* is verified server-side in the `(dashboard)/layout.tsx` via `GET /admin/auth/me`.
- If authenticated cookie present and path is `/admin/login` -> redirect to `/admin`.
- Add `X-Robots-Tag: noindex, nofollow, noarchive` to every `/admin` response.
- Normalisation: lowercase path redirect (301) for public paths with uppercase, strip trailing slash (301), except `/`.
- Staging guard: if `NEXT_PUBLIC_ENABLE_INDEXING=false`, add `X-Robots-Tag: noindex` to all responses.

### 4.8 Reserved slugs for generic pages
Generic `/[slug]` must never shadow routes. API rejects, and the frontend `lib/constants.ts` lists: `admin, api, about, products, brands, services, news, contact, search, faq, thank-you, sitemap, robots, manifest, _next, favicon, static, login`.

### 4.9 Preview (draft) mode
- Admin "Preview" button opens `/api/preview?token=<short-lived JWT from POST /admin/preview-token>&path=/products/x`.
- Route handler verifies token with the API (`GET /admin/preview-token/verify`) or signature using `PREVIEW_SECRET`, calls `draftMode().enable()`, redirects to `path`.
- In draft mode: fetchers add header `X-Preview-Token` and `cache: 'no-store'`; API returns draft/scheduled content (including unpublished entities). `PreviewBanner` (yellow strip, "Preview mode - Exit") shows; `<meta robots noindex>` forced.
- Exit: `/api/preview/exit` disables draft mode and redirects back.

---
## 5. FULL SEO PLAN

### 5.1 URL and slug structure
- All public URLs lowercase, hyphenated, no trailing slash, no file extensions, no IDs. Canonical host is the apex or `www` chosen once (`NEXT_PUBLIC_SITE_URL`); the other host 301s at the reverse proxy; HTTP -> HTTPS 301.
- Slugs: generated from title on create (`slugify`, ASCII, max 80 chars), editable in admin, unique per entity type (API enforces; UI checks via `GET /admin/slug-check?type=&slug=&excludeId=`). Changing a slug of a published entity auto-creates a 301 redirect (API does it; UI shows a notice "A redirect from the old URL will be created").
- Structure:

| Entity | URL pattern | Example |
|---|---|---|
| Home | `/` | |
| About | `/about` | |
| Products list | `/products` | |
| Product category | `/products/category/{categorySlug}` | `/products/category/rock-drills` |
| Product | `/products/{slug}` | `/products/furukawa-rock-drills` |
| Brands list | `/brands` | |
| Brand | `/brands/{slug}` | `/brands/montabert` |
| Services list | `/services` | |
| Service | `/services/{slug}` | `/services/parts-and-accessories` |
| News list | `/news` | |
| Post | `/news/{slug}` | |
| Tag | `/news/tag/{slug}` | |
| FAQ | `/faq` | |
| Contact | `/contact` | |
| Generic page | `/{slug}` | `/privacy-policy`, `/terms` |
| Search | `/search?q=` | noindex |

### 5.2 Metadata API usage
- Root `app/layout.tsx` exports `generateMetadata()` reading settings: `metadataBase = new URL(NEXT_PUBLIC_SITE_URL)`, `title: { default: settings.seo.defaultTitle, template: settings.seo.titleTemplate }` (seed template `%s | Baraton Group Co.`), default description, `applicationName`, `authors`, `creator`, `publisher`, `formatDetection: { telephone: true }`, `alternates.canonical` per page, `verification` (google, bing, yandex from settings), `icons` (from favicon set), `manifest`, `themeColor` (from settings `themeColor`; light/dark entries), `openGraph` defaults (`siteName`, `locale`, `type: website`), `twitter: { card: 'summary_large_image', site: settings.twitterHandle }`, `robots` default derived from env + settings.
- Every page exports `generateMetadata` that calls `buildMetadata({ entity, path, fallbackTitle, fallbackDescription, image, type })` in `lib/seo/metadata.ts`. Resolution order for each field: **entity.seo override (CMS)** -> entity-derived default (title / shortDescription truncated) -> site default.
- `entity.seo` shape (every CMS entity has it): `{ metaTitle?, metaDescription?, canonicalUrl?, noindex: boolean, nofollow: boolean, ogTitle?, ogDescription?, ogImage?: Media, twitterImage?: Media, structuredDataOverride?: object|null, focusKeyword? }`.
- Title rules: <= 60 chars rendered (warn in admin beyond 60, hard cap 70); description 120-160 chars (warn outside range). Template applied once (no double suffix on home: home uses `title.absolute`).
- Canonical: always absolute; self-referencing; paginated/filter pages see 5.8; `canonicalUrl` override only if absolute same-host or explicit external allowed (admin warns).
- Robots meta: indexable pages `index, follow, max-image-preview:large, max-snippet:-1`; noindex pages: admin, search, thank-you, filtered product lists, preview mode, 404, any entity with `seo.noindex`.

### 5.3 Dynamic Open Graph images
- Default `app/opengraph-image.tsx` (1200x630, `ImageResponse`, runtime `nodejs`): logo, site name, tagline from settings.
- Entity-level `opengraph-image.tsx` in `products/[slug]`, `brands/[slug]`, `services/[slug]`, `news/[slug]`: if entity has `seo.ogImage` or cover image, `generateMetadata` points `openGraph.images` directly at the MinIO-derived 1200x630 crop (`url + ?w=1200&h=630` is NOT supported by MinIO; so we use the Next route) otherwise the `ImageResponse` composes: entity title (max 2 lines), country/category badge, brand logo, cover image darkened as background, site logo. Fonts loaded via `fetch` of local TTF in `public/fonts`. Cached by Next; revalidated with the entity tag.
- Twitter image = OG image. `alt` text set.
- Admin shows the OG preview card in the SEO panel (8.12).

### 5.4 JSON-LD structured data
Rendered by `components/seo/JsonLd.tsx` (server component: `<script type="application/ld+json">` with `JSON.stringify` and `<` escaped to `<`). Builders in `lib/seo/jsonld.ts` return plain objects; multiple nodes combined with `@graph` and stable `@id`s (`{origin}/#organization`, `{origin}/#website`, `{pageUrl}#webpage`).

| Page | Schemas |
|---|---|
| Site-wide (root layout) | `Organization` (name, legalName, url, logo (ImageObject), sameAs[socials], contactPoint[{telephone, contactType: "sales", areaServed, availableLanguage}], foundingDate 2007, address PostalAddress, subOrganization [Baraton Trade PLC, Baraton Trade LLC]), `WebSite` with `potentialAction: SearchAction` (`target: {origin}/search?q={search_term_string}`, `query-input: required name=search_term_string`) |
| Home | `WebPage` (+ site-wide graph), `LocalBusiness` (type `Corporation`/`LocalBusiness` with `geo`, `openingHoursSpecification`, `address`, `telephone`, `email`, `hasMap`, `image`, `priceRange` omitted) built from settings offices - one per office flagged `isLocalBusiness` (Addis Ababa; Florida) |
| About | `AboutPage` + `Organization` details (founding, mission as `description`) + `BreadcrumbList` |
| Products list | `CollectionPage` + `ItemList` (first page items with `url`, `position`, `name`, `image`) + `BreadcrumbList` |
| Product detail | `Product` (`name`, `description`, `image[]`, `sku` (if set), `brand: {Brand}`, `manufacturer`, `countryOfOrigin`/`areaServed`, `category`, `additionalProperty[]` from specs as `PropertyValue`, `isRelatedTo` optional, `offers`: omitted unless admin enables "Show availability": then `Offer` with `availability: https://schema.org/InStock`, `priceCurrency` - price is not shown; we never emit a fake price) + `BreadcrumbList` + `FAQPage` if product FAQs present + `VideoObject` if video |
| Brand detail | `Brand`/`Organization` (name, logo, url, `sameAs` website link) + `VideoObject` + `BreadcrumbList` |
| Services list/detail | `Service` (`name`, `description`, `provider -> #organization`, `areaServed` Ethiopia, `serviceType`, `hasOfferCatalog` from `features`) + `BreadcrumbList` |
| FAQ / any page with FAQ block | `FAQPage` (mainEntity Question/Answer, plain text answers) |
| News post | `Article`/`NewsArticle` (`headline`, `datePublished`, `dateModified`, `author` Person/Organization, `image[]`, `publisher`, `mainEntityOfPage`) + `BreadcrumbList` |
| News list | `CollectionPage`/`Blog` + `BreadcrumbList` |
| Contact | `ContactPage` + `Organization.contactPoint` + `LocalBusiness` per office + `BreadcrumbList` |
| Generic page | `WebPage` + `BreadcrumbList` |
| Search | none |

Rules: only emit data that is visible on the page; omit empty properties; validate with Rich Results Test in the QA checklist; `structuredDataOverride` (JSON) in the SEO panel replaces the page's primary node when set (admin validates it parses as JSON with `@type`).

### 5.5 sitemap.xml
- `app/sitemap.ts` using `generateSitemaps()` -> sitemap index when > 5000 URLs (unlikely; still implement chunks of 5000 for correctness). Data from `GET /public/sitemap` which returns `[{ loc(path), lastmod, changefreq?, priority?, images?: [{url,title,caption}], alternates? }]` for every indexable published entity (those with `seo.noindex=false`), including static pages (home, about, contact, lists).
- `lastmod` = entity `updatedAt` (real content change), never "now". Lists use the max `updatedAt` of children.
- Image entries for products/brands/posts (gallery and cover). Video entries are not added in v1.
- Excluded: admin, search, thank-you, filtered URLs, noindex entities, redirected URLs, drafts.
- `Sitemap:` line is in robots.txt. Tag `sitemap` revalidated on any publish/unpublish/delete/slug change.
- Admin can toggle "Include in sitemap" per entity (maps to noindex or a separate `sitemapExclude` flag) and set per-type default changefreq/priority in SEO > Robots & Sitemap.

### 5.6 robots.txt (CMS-controlled)
- `app/robots.ts` reads `GET /public/robots` -> `{ rules: [{userAgent, allow[], disallow[]}], extraText?: string }`. Always appended automatically and non-removable: `Disallow: /admin`, `Disallow: /api/`, `Disallow: /search`, `Sitemap: {origin}/sitemap.xml`, `Host` omitted.
- If `NEXT_PUBLIC_ENABLE_INDEXING=false` -> `User-agent: * Disallow: /` regardless of CMS.
- Admin UI (8.12) has a textarea editor with live validation and a "Reset to default" button; blocks saving rules that disallow `/` in production without a confirmation dialog.

### 5.7 hreflang readiness
- v1 single language: emit `alternates.languages = { 'en': canonical, 'x-default': canonical }` only when `settings.locales.length > 1`; otherwise omit. `lib/seo/urls.ts` has `localizedPath(path, locale)` already used everywhere so introducing `/{locale}` is a mechanical change. Sitemap builder supports `alternates.languages` in entries.

### 5.8 Pagination, filters, faceted URLs
- `/products?page=2`: indexable, canonical self (with `page` param), `rel=prev/next` not needed; title appends " - Page 2". Page 1 canonical is `/products` (strip `page=1`).
- Filters (`q`, `country`, `category`, `sort`): `robots noindex,follow`, canonical to the base `/products` (or the category page). Category landing pages are the indexable facet (`/products/category/{slug}`); country facet is not indexable in v1.
- `/news?page=N` same rules. Tag pages indexable.
- All pagination uses real `<a href>` links (`Pagination` renders anchors), not buttons.

### 5.9 Semantic HTML and heading hierarchy rules
1. Exactly one `<h1>` per page: the page's title (hero headline on home - rendered from the first hero slide's headline OR a visually-hidden `h1` with site tagline when the hero is a carousel of products; carousel slide titles are `h2`/`p`, never `h1`).
2. Sections use `<section aria-labelledby>` with an `h2`; card titles are `h3`; no skipped levels. Markdown content headings are shifted: `#`->`h2`, `##`->`h3`, `###`->`h4`, capped at `h6`.
3. Landmarks: `<header>`, `<nav aria-label="Primary">`, `<main id="main">`, `<aside>` for related, `<footer>`, footer nav `aria-label="Footer"`, breadcrumb `<nav aria-label="Breadcrumb">` with `<ol>`.
4. Lists for repeated items (`<ul>` of cards), `<article>` for cards/posts, `<figure>/<figcaption>` for gallery images, `<address>` for contact blocks, `<time datetime>` for dates, `<dl>` for spec tables where appropriate (or `<table>` with `<th scope>`).
5. Links have descriptive text ("Read more about Montabert", via `aria-label` or visually hidden suffix) - never bare "Read More" without context for screen readers/SEO.
6. Images: meaningful `alt` from CMS (required for non-decorative images; admin blocks publish without alt unless marked decorative -> `alt=""`).
7. Buttons are `<button>`, links are `<a>`; phone numbers `tel:` links (digits with `+`), email `mailto:`.

### 5.10 Internal linking
- Product detail: breadcrumb, brand link (manufacturer), category link, related products (same category/brand, 4), CTA to `/contact?product=slug`, link to relevant services.
- Brand detail: list of its products, link back to `/brands`, related services.
- Service detail: related products/brands (CMS relation fields), contact CTA.
- News: related posts (same tag), links to products mentioned (`relatedProducts` relation field).
- Footer: Quick Links + first 5 featured products + all legal pages; header mega-menu links to every category and brand.
- Markdown renderer: internal links stay relative/same-tab; auto-linking of first mention of product names is NOT automated in v1.
- Breadcrumb visible on all pages except home; matches BreadcrumbList JSON-LD exactly.

### 5.11 Legacy URL 301 map
The migration importer (API side) stores legacy ids; the frontend redirect resolver handles these patterns in `lib/redirects/legacy.ts` (static rules compiled into `next.config.ts redirects()`), with id->slug lookups by `GET /public/redirects/resolve?path=`:

| Old URL | New URL |
|---|---|
| `/product/:id` | `/products/{slug}` |
| `/products/:id` (if numeric/ObjectId) | `/products/{slug}` |
| `/comapny/:id`, `/company/:id`, `/companies/:id` | `/brands/{slug}` |
| `/service` | `/services` |
| `/services/:id` (ObjectId) | `/services/{slug}` |
| `/about-us`, `/aboutus` | `/about` |
| `/contact-us`, `/contactus` | `/contact` |
| `/home`, `/index` | `/` |
| `/admin-login`, old admin paths (`/admin/products/edit/:id`...) | `/admin/login` or the nearest new admin screen (301 not needed; best effort) |

All are 301 (permanent). Redirect chains max 1 hop (admin redirect manager flags chains). Old Cloudinary image URLs are not redirected (images re-hosted).

### 5.12 Core Web Vitals budget (p75, mobile, 4G, mid-tier device)

| Metric | Target | Hard limit |
|---|---|---|
| LCP | <= 2.0 s | 2.5 s |
| CLS | <= 0.02 | 0.1 |
| INP | <= 150 ms | 200 ms |
| TTFB (cached HTML) | <= 200 ms | 600 ms |
| JS shipped, home route (gzip) | <= 130 kB | 170 kB |
| JS shipped, other public routes | <= 110 kB | 150 kB |
| Total page weight home (first load) | <= 900 kB | 1.5 MB |

Enforcement: Lighthouse CI assertions in CI (perf >= 0.9 mobile on home, product detail, products list, contact), `@next/bundle-analyzer` check, size-limit budget script.

Rules to hit budgets:
- Hero LCP image: `priority`, correct `sizes`, AVIF/WebP, explicit dimensions, no carousel JS before first paint (first slide server-rendered; Embla hydrates later; autoplay starts after `requestIdleCallback`).
- Below-the-fold sections lazy: `next/dynamic` for `Lightbox`, `VideoFacade`, `TestimonialsCarousel`, charts, Tiptap (admin only).
- YouTube: **facade pattern** (thumbnail `https://i.ytimg.com/vi/{id}/hqdefault.jpg` + play button; iframe from `youtube-nocookie.com` injected on click). No iframes on initial load.
- Map embed: click-to-load facade as well (static preview image or neutral block + "Load map"), iframe `loading="lazy"`.
- Third-party scripts (GTM/GA) via `next/script` strategy `afterInteractive`/`lazyOnload`, only after consent (5.13).
- No layout shift: all media has intrinsic ratio; skeletons match final size; fonts use `size-adjust` via `next/font`; marquee has fixed height.
- Avoid client-side data fetching on public pages. Prefetch links default; heavy lists use `prefetch={false}` for footers long lists.

### 5.13 Analytics, Search Console, Tag Manager (CMS-configurable)
Settings fields (Site Settings > "Analytics & Tags"): `ga4MeasurementId` (G-XXXXXXXXXX), `gtmContainerId` (GTM-XXXXXXX), `googleSiteVerification`, `bingSiteVerification`, `yandexVerification` (meta tags), `metaPixelId` (optional), `customHeadScripts` (NOT supported - security), `consentMode: 'off'|'banner'`, `anonymizeIp`.
- `components/analytics/Analytics.tsx` (server) renders `next/script` tags only when IDs present, in production, and not in draft mode. If both GTM and GA4 are set, GA4 is NOT loaded directly (GTM expected to manage it; admin shows a warning).
- Consent: `CookieConsent` banner (client) when `consentMode = banner`; default consent state denied (Consent Mode v2 `gtag('consent','default',...)` injected before GTM); accepting updates consent. Choice stored in a first-party cookie `bt_consent` (180 days).
- Events pushed to `dataLayer` (typed helper `lib/analytics/track.ts`): `generate_lead` (contact form success), `view_item` (product detail), `select_content` (inquiry button), `file_download` (brochure), `search` (search submit), `click_phone`, `click_email`, `video_play`.
- Verification meta tags come through Metadata API `verification`.

### 5.14 Favicon, manifest, theme color
- CMS Site Settings holds favicon source (square PNG >= 512) and optional dark favicon. The API produces derivatives: `favicon.ico` (48), `icon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180), `maskable-512.png`, plus `og-default.png`. The frontend route handlers `app/favicon.ico/route.ts`, `app/icon-[size]/route.ts`, `app/apple-icon/route.ts` proxy the MinIO URLs with long cache headers (so favicon is served from the site origin as crawlers expect), falling back to `public/` defaults seeded from `logo.png`.
- `app/manifest.ts`: `name`, `short_name`, `description`, `start_url: '/'`, `display: 'browser'`/`standalone`, `background_color`, `theme_color` (from settings), icons incl. maskable.
- `<meta name="theme-color">` light/dark via Metadata `themeColor` array.

### 5.15 Accessibility checklist (WCAG 2.2 AA) - implementation rules
1. Skip link ("Skip to main content") first focusable element; `main` has `tabindex="-1"` for focus after route change.
2. Visible focus indicator on every interactive element (>= 3:1 contrast, >= 2 px) (2.4.7, 2.4.11 focus not obscured: sticky header must not cover focused elements -> `scroll-padding-top`).
3. Colour contrast: text 4.5:1, large text/UI 3:1 - tokens from the design spec are verified by an automated contrast test in CI.
4. Target size >= 24x24 CSS px (2.5.8), buttons/touch targets 44 px on mobile by convention.
5. Keyboard: mega menu opens on Enter/Space/ArrowDown, Esc closes and returns focus; carousel has prev/next buttons, pause/play control (2.2.2), slides `role="group" aria-roledescription="slide" aria-label="n of N"`; marquee pausable (button + hover/focus) and disabled under `prefers-reduced-motion`.
6. Forms: every input has a visible `<label>`; errors associated by `aria-describedby`, announced via `aria-live="polite"`; error summary focus on submit failure; required fields marked with text not only colour; autocomplete attributes (`name`, `email`, `tel`, `organization`) (1.3.5); no CAPTCHA that is cognitive test - Turnstile managed/invisible mode; honeypot hidden with `aria-hidden` and `tabindex=-1`.
7. Redundant entry (3.3.7): inquiry from product pre-fills; admin forms keep values after validation errors.
8. Accessible authentication (3.3.8): login form allows paste, password managers (`autocomplete="current-password"`), no puzzle. 2FA OTP allows paste.
9. Images alt; decorative `alt=""`; icons `aria-hidden`; icon-only buttons have `aria-label`.
10. Language: `<html lang>`; foreign names marked if needed.
11. Reduced motion & `prefers-contrast` respected; no content only on hover.
12. Dialogs/sheets trap focus (Radix), labelled, restore focus. Toasts use `role=status` (sonner) and are persistent enough (>= 5 s, with close button).
13. Tables: `<caption>`/`aria-label`, header cells scoped; admin tables keyboard-sortable, row actions reachable.
14. Zoom/reflow: usable at 200% and 320 px width, no horizontal scroll (1.4.10), text spacing override safe.
15. Dragging alternatives (2.5.7): every drag-and-drop list (nav, sections, gallery) also offers "Move up/Move down" buttons and keyboard reordering via dnd-kit keyboard sensor.
16. Videos: facade buttons labelled "Play video: {title}"; YouTube iframes titled.
17. Page titles unique and descriptive; focus moves to `h1` on client navigation in admin.
18. Automated: `@axe-core/playwright` on every template in e2e; manual screen reader pass (NVDA + VoiceOver) before launch.

### 5.16 noindex for admin and non-public surfaces
`(admin)/admin/layout.tsx` exports `metadata.robots = { index:false, follow:false, nocache:true }`; middleware adds `X-Robots-Tag`; robots.txt disallows `/admin`; admin pages are excluded from sitemap; auth pages too. Preview-mode pages noindex.

### 5.17 Pre-launch SEO checklist (also mirrored in section 12)
Canonical host redirect; HTTPS/HSTS; one h1 per page; unique titles/descriptions on all indexable URLs; JSON-LD validates; sitemap submitted in GSC; robots.txt reviewed; 301 map tested for every legacy URL; no `noindex` leaking to production; analytics firing with consent; OG/Twitter previews validated; images have alt; CWV within budget on real device; 404 status codes correct (soft-404 free); hreflang absent (single language) without errors; breadcrumbs match JSON-LD; GSC + Bing verified; Lighthouse SEO 100.

---

## 6. PUBLIC SITE - page-by-page specification

Conventions for this section:
- "Fields" refer to the CMS/API field names (camelCase) in the public API responses (section 11.2).
- Breakpoints (used generically; exact values in design doc): mobile < 640, tablet 640-1023, desktop >= 1024, wide >= 1440.
- Every page: `SiteHeader`, `Breadcrumbs` (except home), `<main>`, `SiteFooter`.
- Every list: loading skeleton, empty state (copy from messages), error state (retry).
- Metadata column: title pattern / description source / OG / JSON-LD.

### 6.1 Home `/`

Rendered from `GET /public/home` => `{ seo, sections: Section[] }` using the block registry (7.4). Default seeded order and content:

| # | Section type | Content fields consumed | Notes |
|---|---|---|---|
| 1 | `hero` | `slides[]: { id, kind: 'product'|'custom', productRef?, headline, subheadline, image: Media, ctaPrimary:{label,href}, ctaSecondary?, badge? (country) }`, `autoplayMs` (default 6000), `showThumbnails` boolean | Slides can be auto-filled from featured products (`source: 'featuredProducts'`, `limit: 8`) or custom. Shows counter "1/8" and thumbnail strip like the live site. First slide SSR + `priority`. Hidden `h1` fallback if slides use `h2`. |
| 2 | `brandsMarquee` | `heading` ("Brands We Work With"), `subheading` ("Trusted by industry leaders worldwide"), `source: 'brands'` (all published brands with logo, ordered by `sortOrder`) or manual `brands[]`, `speed`, `linkToBrand` boolean | Logos link to `/brands/{slug}`. Duplicate track for the infinite loop; `aria-hidden` on duplicate. |
| 3 | `companyStory` | `logo: Media`, `paragraphs: string[]` (4 live paragraphs), `ctaPrimary` ("Learn more" -> `/about`), `ctaSecondary` ("Our Products" -> `/products`), `milestones?: {year,text}[]` | Dark/contrasting block per design. |
| 4 | `stats` (new, optional, default enabled) | `items: {value:number, suffix?, label}[]` e.g. 2007 founded, 9 brands, 8 products lines, 2 countries | Count-up when visible, static under reduced motion. |
| 5 | `featuredProducts` | `heading`, `source: 'featured'|'manual'|'latest'`, `limit`, `productRefs[]`, `viewAllHref` | grid of `ProductCard` |
| 6 | `services` | `heading` ("Our Services"), `source: 'all'|'manual'`, `serviceRefs[]` | cards with icon/image, feature bullets (first 3) and link |
| 7 | `videos` | `heading` ("Featured Videos"), `subheading` ("Discover our work through these immersive experiences"), `videoRefs[]` or `source:'featured'`, `limit: 6` | 3x2 grid, facade embeds |
| 8 | `testimonials` | `heading`, `items` from relations | hidden when empty |
| 9 | `news` | `heading`, `limit: 3` | hidden when empty |
| 10 | `ctaBanner` | `heading`, `text`, `ctaPrimary` ("Let's Talk" -> `/contact`), `phone` shown | |

Responsive: hero full-bleed; mobile hides thumbnails strip (dots only), 1-col grids, marquee reduced height; tablet 2 cols; desktop 3 cols (videos 3x2).
Interactions: hero prev/next/pause, thumbnail click, swipe; marquee pause on hover/focus; videos click-to-play; product card share.
States: sections whose data resolved empty are skipped (never render empty heading); if the whole API call fails with no cache -> error boundary.
SEO: title `absolute` = settings.seo.homeTitle (seed "Baraton Group Co. | Rock Drilling, Air Compressors & Construction Machinery in Ethiopia"); description from home `seo`; JSON-LD per 5.4; LCP = first hero image.

### 6.2 About `/about`
Sections (from `GET /public/about`): 
1. `pageHeader`: `title` ("About Us"), `intro`, `heroImage`.
2. `companyStory`: long text blocks (markdown) from About content (2007 origins, growth, 2019 USA + woodworking factory), `timeline[]: {year, title, description}` (seed: 2007, 2019, + brand additions).
3. `ceoMessage`: `title` ("CEO's Message"), `bodyMarkdown` (two paragraphs from ui-strings), `name`, `role`, `photo`.
4. `missionVision`: `missionItems: string[]` (4 bullets), `visionText`, optionally `valuesItems`/"Philosophy".
5. `subsidiaries`: two cards: Baraton Trade PLC (Ethiopia) and Baraton Trade LLC (USA) each with `name, country, description, highlights[]` (LLC: Technological Solutions, Real Estate Development & Portfolio Management, Stock & Share Portfolio Management, Global Product Distribution; exclusive rights lists Furukawa and Airman; PLC: genuine parts, technical support, self-repair resources). Anchors `#baraton-trade-plc`, `#baraton-trade-llc`.
6. `capabilities`: "Construction machinery, Rock drilling tools, Hydraulic attachments, Equipment servicing & support".
7. `brandsMarquee` (reuse), 8. `stats` (reuse), 9. `ctaBanner`.
Tabs: the live site uses tabs/anchors for CEO Message / Philosophy / Baraton Trade LLC / Baraton Trade PLC; implement as an in-page sticky sub-nav (anchor links, `IntersectionObserver` highlight) rather than JS tabs so all content is crawlable.
Responsive: sub-nav becomes horizontally scrollable chips on mobile.
SEO: title "About Us"; JSON-LD `AboutPage`, Organization with `foundingDate`, `subOrganization`.

### 6.3 Products list `/products`
- Page header: title "Products", intro text (CMS `productsIntro`).
- Toolbar (sticky below header on desktop): search input (debounced 300 ms, submit updates `?q=`), filters: Country (select/checkbox from `GET /public/products/facets` -> `{countries:[{value,label,count}], categories:[{slug,name,count}], brands:[...]}`), Category, Brand; Sort (`featured` default, `name-asc`, `newest`); result count live region; "Clear filters". Mobile: filters in a `sheet`/`drawer` opened by a "Filters" button with active-count badge.
- Grid: `ProductCard` (image 4:3, country badge, share button, title, shortDescription clamp 3 lines, "Read More" link -> `/products/{slug}`, optional "Request quote" secondary). 1 col mobile, 2 tablet, 3 desktop (4 wide).
- Pagination: server-driven, 12 per page, anchors `?page=N` (preserve other params).
- Filter state lives in the URL (server component reads `searchParams`; filters are `<form method="get">` progressive enhancement + client enhancement for instant UX with `useRouter().replace` + `startTransition`).
- Empty: "No products found" + clear filters button + contact CTA. Loading: 6 skeleton cards (`loading.tsx` + Suspense around grid). Error: retry.
- SEO: title "Products" (+ " - Page N"); canonical per 5.8; JSON-LD CollectionPage/ItemList/Breadcrumb; filtered => noindex.
- Category sub-route `/products/category/[categorySlug]`: same grid pre-filtered, has its own `h1`, intro text (`category.description` markdown), `seo` fields, indexable.

### 6.4 Product detail `/products/[slug]`
Fields from `GET /public/products/{slug}`: `id, slug, title, shortDescription, country, brand:{slug,name,logo}, category:{slug,name}, coverImage, gallery: Media[], contentMarkdown, specs: {group?, label, value, unit?}[], features: string[], brochures: {title, file:{url,size,mimeType}}[], videoUrl?, faq?: {q,a}[], relatedProducts: ProductCard[], relatedServices?, sku?, updatedAt, seo`.
Sections in order:
1. Breadcrumb: Home > Products > (Category) > Title.
2. Top block: left `ProductGallery` (main image + thumbs; click opens `Lightbox` with keyboard arrows/Esc; swipe on mobile; first image `priority`); right: country badge, `h1` title, brand link, shortDescription, key features bullets (max 5), CTA row: primary "Request a quote" (-> `/contact?product={slug}&subject=quote`), secondary "Download brochure" (one button or dropdown if multiple; tracked `file_download`), tertiary share button (Web Share API fallback to copy-link dropdown: copy link, WhatsApp, LinkedIn, X, Facebook, Email).
3. `Tabs` (or stacked anchors on mobile? decision: tabs on desktop, accordion on mobile, but ALL content present in DOM for crawlers): "Overview" (rendered markdown), "Specifications" (`SpecTable`, grouped), "Downloads" (brochures list with size and type), "Video" (facade if `videoUrl`). Tabs absent when empty.
4. Inquiry strip: "Interested in {title}?" + phone + button; includes WhatsApp click-to-chat if settings.whatsappNumber.
5. FAQ accordion (if present).
6. Related products carousel/grid (4) + "Related services".
States: 404 -> `notFound()`; missing gallery -> placeholder; missing brochure -> button hidden.
SEO: title `{metaTitle || title}`; description `metaDescription || shortDescription`; OG image = cover or generated; JSON-LD Product + Breadcrumb (+FAQ, +VideoObject).
The legacy markdown (with `# ` headings and stray `#### #####` tokens) is cleaned by the importer; the renderer shifts headings and strips empty headings.

### 6.5 Brands / Partners `/brands`
- Header: title "Brands We Work With" (CMS `brandsIntro`), intro.
- Filter chips by country (from facets), optional search; grid `BrandCard` (logo on neutral tile, name, country badge, short description clamp 3, "View brand").
- Special badge: "Official agent" for brands flagged `isExclusiveAgent` (Furukawa, Airman).
- Empty/loading/error as above. SEO: CollectionPage + ItemList.

### 6.6 Brand detail `/brands/[slug]`
Fields: `name, slug, logo, country, shortDescription, descriptionMarkdown, videoUrl (normalised youtube id), website?, isExclusiveAgent, products[] (relation), services[] (relation), gallery?, seo`.
Sections: breadcrumb; `BrandHero` (logo, `h1` name, country, official-agent badge, short description, CTA "Contact us about {name}", external website link `rel=noopener`); description (markdown); video (facade, 16:9, only if valid id - invalid values such as `a` are rejected by the admin and importer); "Products from {name}" grid (from relation, hidden if empty); related services; other brands carousel; CTA.
SEO: title `{name}`; JSON-LD Brand/Organization + VideoObject + Breadcrumb.

### 6.7 Services `/services` and `/services/[slug]`
List: header (title "Our Services", intro), cards (`ServiceCard`: image or icon, title, shortDescription, first 3 `features`, "Learn more"). Seed: Parts and Accessories; Maintenance and Service. 1/2 cols.
Detail fields: `title, slug, shortDescription, icon?, image, features: string[], descriptionMarkdown?, process?: {step,title,text}[], relatedBrands[], relatedProducts[], faq?, seo`.
Sections: breadcrumb; hero (h1, image, shortDescription, CTA "Request this service" -> `/contact?service={slug}&subject=service`); "What is included" checklist from `features`; description; process steps; related brands/products; FAQ; CTA banner.
SEO: JSON-LD Service + Breadcrumb (+FAQ).

### 6.8 Contact `/contact`
Fields from `GET /public/contact` + settings: `title, intro, offices[]: {id, name, country, addressLines[], phones[], email, hours?, mapEmbed:{lat,lng,zoom,placeQuery?}, isPrimary}`, `socials[]`, `formSettings: {subjects[], captchaProvider, successMessage, consentText}`.
Layout: header ("Contact Information: Fill out the form or contact us through these channels"); two columns desktop (form left, info right), stacked mobile with info first? Decision: form first on mobile, info below.
Info panel: per office `<address>` with Address, Phone (each `tel:`), Email (`mailto:`), hours, "Follow Us" socials, "Get directions" link (`https://www.google.com/maps/search/?api=1&query=`). Offices: Addis Ababa (Baraton Trade PLC) and Florida USA (Baraton Trade LLC; address seeded blank, admin fills; hidden if no address).
Form (`ContactForm`, RHF + zod, Server Action `submitContact` -> `POST /public/contact-messages`):
| Field | Rules |
|---|---|
| `name` | required, 2-100 chars, trimmed |
| `email` | required, valid email, <= 254 |
| `phone` | optional, E.164-tolerant regex `^[+0-9()\-\s]{7,20}$` |
| `company` | optional, <= 120 |
| `subject` | select from `subjects` (General, Product quote, Service request, Parts, Partnership); prefilled from `?subject=` |
| `productSlug` | hidden/readonly chip "Inquiry about: {product title}" prefilled from `?product=`; removable |
| `message` | required, 10-3000 chars, counter |
| `consent` | checkbox required: "I agree to the processing of my data" with link to /privacy-policy (if page exists) |
| `website` (honeypot) | must be empty; hidden |
| `captchaToken` | required when provider != none |
| `startedAt` | hidden timestamp; submissions < 3 s rejected by API |
Behaviour: submit -> pending state (button spinner, fields disabled) -> success: inline success panel + toast + `dataLayer generate_lead` + optional redirect to `/thank-you` (setting); errors: field errors mapped from 422 `errors[]`, 429 "Too many attempts, try later", network error with retained values. Native no-JS fallback works through Server Action form post.
Map: `MapEmbed` facade (static neutral card with address + "Load map" button) injecting Google Maps embed iframe (`https://www.google.com/maps/embed/v1/place?...` or no-key `maps.google.com/maps?q=..&output=embed`) with `loading="lazy"` and `title`. One map tab per office when > 1.
SEO: title "Contact Us"; JSON-LD ContactPage + LocalBusiness + Breadcrumb.

### 6.9 News / Blog `/news` and `/news/[slug]`
List: header, tag filter chips, featured post (first) + grid `PostCard` (cover, tag badges, title, excerpt, date `<time>`, reading time), pagination 9 per page. Empty: "No news yet." Hidden from nav/footer when no published posts (setting `news.enabled` auto-computed).
Detail fields: `title, slug, excerpt, coverImage, bodyMarkdown, tags[], author:{name,avatar?}, publishedAt, updatedAt, readingTime, relatedProducts[], seo`.
Sections: breadcrumb; header (tags, h1, meta: author/date/reading time, share); cover; article body with auto-generated table of contents when >= 3 `h2` (sticky on desktop); related products; related posts (3); CTA.
SEO: Article JSON-LD; OG type `article` with `publishedTime`, `modifiedTime`, `authors`, `tags`.

### 6.10 FAQ `/faq`
Fields: `title, intro, groups[]: {title, items:[{id,question,answerMarkdown}]}`. Accordion per group (type multiple, first open optional), anchor links per question (`#q-{id}`), client-side filter input (progressive, hidden if JS off). FAQPage JSON-LD for all items (<= 100). CTA at bottom.

### 6.11 Generic CMS page `/[slug]`
Fields: `title, slug, template: 'default'|'legal'|'landing', bodyMarkdown | sections[] (same block registry as home), updatedAt, seo`. `legal` template: narrow prose column, "Last updated {date}", auto table of contents. Seeds: `privacy-policy`, `terms`. 404 if slug not found or draft.

### 6.12 Search results `/search?q=`
Server-rendered from `GET /public/search?q=&type=&page=` => grouped results `{products[], brands[], services[], posts[], pages[]}` with counts. UI: search input (autofocus when empty), result tabs/filter chips (All, Products, Brands, Services, News), result list with highlighted snippet, pagination. Empty: "No results for '{q}'" + suggestions (popular products, contact CTA). `noindex,follow`. Min query 2 chars. Header search (Command palette, 7.2) hits `GET /public/search/suggest?q=` (client, debounced, 5 results per group) and "See all results" navigates here.

### 6.13 404 Not found
Branded page, `h1` "Page not found", search box, links to Home/Products/Brands/Contact, top 4 featured products. HTTP 404. noindex. Logs the path to API `POST /public/not-found-log` (fire-and-forget, sampled) so admin can see 404 hits in SEO > Redirects ("Suggested redirects").

### 6.14 Thank you `/thank-you`
Static confirmation (used only if setting enabled), noindex, link back home and to products.

---
