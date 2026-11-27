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
