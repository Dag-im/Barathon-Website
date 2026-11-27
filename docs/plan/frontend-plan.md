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
  - Company (brand): `logo_image, company_name, company_short_discription, company_youtubeLink, company_description, company_country`. 9 companies: Nakayama, Sumitomo Construction Machinery Co. Ltd, Montabert, Elsasser, Monark, Walter Geratebou, Carmix, Furukawa Rock Drill Co, AIRMAN. Data is dirty: country values like "Tokyo,Japan", "sweden", "Saitama, Japan"; one YouTube link is the literal string `a`; links come as `watch?v=` or `embed/` with `&t=`/`?si=` params. The importer must normalise these (see 11.4).
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
3. Redirect rules validation in admin prevents loops (8.14).

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
- Admin shows the OG preview card in the SEO panel (8.14).

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
- Admin UI (8.14) has a textarea editor with live validation and a "Reset to default" button; blocks saving rules that disallow `/` in production without a confirmation dialog.

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

### 5.17 Pre-launch SEO checklist (also mirrored in section 10.5)
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
## 7. Component inventory (public)

Types below are TypeScript-shaped contracts (informational; generated API types are the source of truth for entity shapes). `Media` = `{ id: string; url: string; width: number; height: number; alt: string; blurDataURL?: string; focalPoint?: {x:number;y:number}; mimeType: string }`. `Cta` = `{ label: string; href: string; external?: boolean; variant?: 'primary'|'secondary'|'ghost' }`.

### 7.1 Layout components (`components/layout`)

| Component | Kind | Props | Behaviour |
|---|---|---|---|
| `SiteHeader` | server | `{ settings: SiteSettings; nav: NavItem[] }` | Logo (links `/`, `h1`-free), primary nav, search trigger, "Let's Talk" CTA (`settings.headerCta`, phone icon), sticky with shrink on scroll (CSS only + tiny client island `HeaderScrollState`). Top utility strip optional (phones/email) from `settings.topbar`. |
| `MegaMenu` | client | `{ items: NavItem[] }` | Built on `navigation-menu`. "Products" item opens a panel: columns = product categories (links) + "Featured products" (thumb cards) + brands list; panel content comes from nav item `type: 'mega'` with `megaSource: 'productCategories'|'brands'|'manual'`. Hover-intent delay 120 ms, keyboard accessible. Other items are plain links. |
| `MobileNav` | client | `{ items: NavItem[]; cta: Cta; contact: ContactBlock }` | `sheet` from right; accordion for items with children; large tap targets; includes search field, CTA, phone/email links, socials; closes on route change. |
| `SearchCommand` | client | `{ placeholder: string }` | `command` dialog opened by header search button, `/` or Cmd/Ctrl+K; debounced suggestions from `/public/search/suggest`; grouped Products/Brands/Services/News/Pages; Enter on free text goes to `/search?q=`; recent searches in localStorage (max 5). |
| `SiteFooter` | server | `{ settings; footer: FooterConfig }` | Columns: brand blurb + socials; Quick Links; Our Products (first N featured, `footer.productsLimit` default 5); Contact Us (address, phones, email); bottom bar: `© {year} {legalName}. All rights reserved.` and credit **"Developed by Dagim Meseret"** (see 8.2 decision: hard-coded constant in `lib/constants.ts` `DEVELOPER_CREDIT = { text: 'Developed by', name: 'Dagim Meseret', href?: env NEXT_PUBLIC_DEVELOPER_URL }`, not CMS-editable, not removable). |
| `Breadcrumbs` | server | `{ items: {label: string; href?: string}[] }` | shadcn `breadcrumb`; also produces JSON-LD via `BreadcrumbJsonLd`. Last item `aria-current="page"`. |
| `SkipLink` | server | none | |
| `PreviewBanner` | client | none | shown in draft mode. |
| `CookieConsent` | client | `{ enabled: boolean }` | banner with Accept all / Reject / Preferences. |
| `PageHeader` | server | `{ title: string; intro?: string; image?: Media; breadcrumbs: ...; actions?: ReactNode }` | renders the `h1`. |

`NavItem`: `{ id: string; label: string; href?: string; type: 'link'|'mega'|'dropdown'; children?: NavItem[]; megaSource?: ...; openInNewTab?: boolean; highlight?: boolean }`. `FooterConfig`: `{ blurb: string; columns: { id; title; links: {label;href}[]; source?: 'featuredProducts' }[]; showSocials: boolean; legalLinks: {label;href}[]; copyrightText: string }`.

### 7.2 Content components

| Component | Kind | Props |
|---|---|---|
| `CmsImage` | server | `{ media: Media|null; sizes: string; priority?: boolean; className?: string; fill?: boolean; ratio?: string; fallback?: 'product'|'logo'|'generic' }` |
| `Markdown` | server | `{ source: string; headingOffset?: 1|2; className?: string }` |
| `VideoFacade` | client | `{ youtubeId: string; title: string; thumbnail?: Media; aspect?: '16/9' }` (loads `youtube-nocookie.com/embed/{id}?autoplay=1`) |
| `ShareButton` | client | `{ url: string; title: string; text?: string; variant?: 'icon'|'button' }` (Web Share API, fallback dropdown) |
| `Lightbox` | client (dynamic) | `{ images: Media[]; startIndex: number; open: boolean; onOpenChange }` |
| `LogoMarquee` | server + CSS | `{ items: {id,name,logo:Media,href?}[]; speed?: 'slow'|'normal' }` |
| `StatCounter` | client | `{ items: {value:number;suffix?:string;label:string}[] }` |
| `SpecTable` | server | `{ specs: Spec[] }` grouped by `group` |
| `Prose` | server | wrapper for typographic styles from design spec |
| `JsonLd` | server | `{ data: object | object[] }` |
| `MapEmbed` | client | `{ office: Office }` facade -> iframe |
| `PhoneLink`, `EmailLink` | server | `{ value: string; label?: string; track?: boolean }` |
| `StatusEmpty`, `StatusError` | server/client | `{ title; description; action? }` |

### 7.3 Section/block components (`components/sections`)
Each takes `{ block: <TypeSpecificBlock>; index: number }` and renders one `<section>` with `aria-labelledby`. Common block base: `{ id: string; type: SectionType; enabled: boolean; anchorId?: string; theme?: 'default'|'muted'|'dark'|'brand'; paddingY?: 'sm'|'md'|'lg'; heading?: string; subheading?: string }`.

| Type key | Component | Specific props |
|---|---|---|
| `hero` | `HeroSection` (+client `HeroCarousel`) | `slides: HeroSlide[]; autoplayMs: number; showThumbnails: boolean; source?: 'featuredProducts'; limit?: number` |
| `brandsMarquee` | `BrandsMarqueeSection` | `source: 'all'|'manual'; brandRefs?: string[]; speed` |
| `companyStory` | `CompanyStorySection` | `logo?: Media; paragraphs: string[]; ctaPrimary?: Cta; ctaSecondary?: Cta` |
| `stats` | `StatsSection` | `items: StatItem[]` |
| `featuredProducts` | `FeaturedProductsSection` | `source: 'featured'|'latest'|'manual'; limit: number; productRefs?: string[]; viewAll?: Cta` |
| `services` | `ServicesSection` | `source: 'all'|'manual'; serviceRefs?: string[]` |
| `videos` | `VideosSection` | `source: 'featured'|'manual'; videoRefs?: string[]; limit: number` |
| `testimonials` | `TestimonialsSection` | `source: 'all'|'manual'; testimonialRefs?: string[]` |
| `faq` | `FaqSection` | `source: 'group'|'manual'; groupId?: string; items?: FaqItem[]` |
| `news` | `NewsSection` | `limit: number; tag?: string` |
| `richText` | `RichTextSection` | `bodyMarkdown: string; align?: 'left'|'center'; maxWidth?: 'prose'|'wide'` |
| `imageText` | `ImageTextSection` | `image: Media; imagePosition: 'left'|'right'; bodyMarkdown: string; cta?: Cta` |
| `ctaBanner` | `CtaBannerSection` | `text: string; ctaPrimary: Cta; ctaSecondary?: Cta; showPhone?: boolean` |
| `cardGrid` | `CardGridSection` | `columns: 2|3|4; cards: {icon?: string; image?: Media; title; text; href?}[]` |
| `ceoMessage` | `CeoMessageSection` | `name; role; photo?: Media; bodyMarkdown` |
| `missionVision` | `MissionVisionSection` | `missionItems: string[]; visionText: string; valuesItems?: string[]` |
| `subsidiaries` | `SubsidiariesSection` | `items: {id; name; country; description; highlights: string[]; logo?: Media; ctaHref?}[]` |
| `timeline` | `TimelineSection` | `items: {year; title; description}[]` |
| `contactCta` | `ContactCtaSection` | `showOffices: boolean` |
| `productList` / `brandList` | reuse card grids with a ref list | |

### 7.4 Block registry pattern
- File `components/sections/registry.ts`: `export const sectionRegistry: Record<SectionType, { component: ComponentType<any>; schema: ZodSchema; label: string; icon: LucideIcon; defaultBlock: () => Block; allowedOn: ('home'|'page'|'about')[] }>`.
- `components/sections/SectionRenderer.tsx` (server): `({ sections, context }) => sections.filter(s => s.enabled).map(s => registry[s.type]?.component && <Component key={s.id} block={s} />)`. Unknown type -> render nothing and `console.warn` (never crash). Each block wrapped in an error boundary (`SectionBoundary`) so one broken block does not break the page.
- Data resolution: the API returns blocks with relation refs already expanded where `source` is not `manual` (preferred, one round trip). If the API returns only ids, `SectionRenderer` calls batched fetchers in parallel via `Promise.all` before rendering. Frontend never waterfalls fetches.
- The same registry drives the admin Homepage Builder: each registry entry also exports an `EditorForm` (in `components/admin/sections/{Type}Form.tsx`) built from the same zod schema, so adding a new block = one render component + one schema + one admin form + one registry line.
- Section order and `enabled` flag come from the CMS array order; `anchorId` allows deep links; first section's heading level logic: page-level `h1` rule in 5.9.

---

## 8. ADMIN CMS UI SPEC

### 8.1 Shell and conventions
- Route base `/admin`. Layout `AdminShell`: left `sidebar` (collapsible; mobile via `sheet`), top bar (breadcrumb, global command palette Cmd/Ctrl+K "Go to...", "View site" external link, notifications bell for unread messages count, user menu: Profile, Sign out). Sidebar groups:
  - **Overview**: Dashboard
  - **Content**: Homepage, Pages, About, Products (Products, Categories), Brands, Services, Videos, Testimonials, FAQ, News
  - **Media**: Media Library
  - **Inbox**: Messages (unread badge)
  - **Site**: Site Settings, Navigation & Footer, SEO (Overview, Redirects, Robots & Sitemap, Analytics & Tags)
  - **System**: Revisions, Audit Log, Account
- Permission model: single role `admin`; every admin route is guarded server-side (layout fetch `/admin/auth/me`, 401 -> redirect login) and by middleware; API enforces authorisation. No permission toggles in UI. Dangerous actions (delete, restore, bulk delete, clear cache) use `alert-dialog` with typed confirmation for irreversible bulk ops.
- **Standard list screen anatomy** (`EntityListScreen`): header (title, count, primary "New {entity}" button), toolbar (search with 300 ms debounce, filter selects, status tabs All/Published/Draft/Scheduled/Archived, column visibility, density), `DataTable` (TanStack Table: server-side pagination/sort/filter via query params synced to URL, row selection, sticky header, row actions menu), bulk action bar (appears when rows selected), empty state (illustration-free icon, heading "No {entities} found", button "Add your first {entity}", per ui-strings), loading skeleton rows, error state with retry.
- **Standard edit screen anatomy** (`EntityFormScreen`): sticky `PublishBar` at top (title, status badge, "Saved x min ago", buttons: Save draft, Publish/Update, Schedule (popover with date-time), Preview, History (opens `RevisionDrawer`), More: Duplicate, Archive, Delete) ; two-column desktop: main form tabs (Content | Media | Details | SEO | Relations as applicable) + right sidebar (status, slug, featured toggle, sort order, last edited by, created/updated); single column on mobile.
- **Unsaved changes guard**: `useUnsavedChanges(isDirty)` -> `beforeunload` prompt + intercept in-app navigation (Next `Link` click capture and `router` wrappers via a global `NavigationGuardContext`) with a `dialog` "Discard changes? / Keep editing / Discard".
- **Autosave draft**: every 30 s when dirty and the entity already exists, `PATCH ...?autosave=true` stores a draft revision without publishing (status unchanged). Indicator "Draft autosaved".
- **Optimistic updates**: toggles (featured, enabled, published), reorder (drag-drop), delete from list, message read/unread, bulk status change update the TanStack Query cache immediately and roll back with toast error on failure. Form saves are NOT optimistic (wait for the server, show pending).
- **Concurrency**: entity `version` (or `updatedAt`) sent as `If-Match`; 409/412 -> dialog "This item was changed elsewhere. Reload / Overwrite".
- **Validation**: zod schemas in `lib/validation/*` mirror API rules; server 422 errors mapped to fields by `applyServerErrors(form, error)`; field-level messages under input; form-level error alert at top; scroll/focus first invalid field.
- **Toasts**: success "Saved", "Published", "Deleted" (with Undo for soft deletes within 8 s where API supports `restore`), errors show message + `Retry` where applicable; never toast field validation errors.
- **Slug field** component `SlugField`: auto from title until manually edited, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, uniqueness check on blur, shows full URL preview.
- **Common sidebar fields**: `status: 'draft'|'published'|'scheduled'|'archived'`, `publishAt` (when scheduled), `sortOrder`, `featured`.
- Keyboard: Cmd/Ctrl+S saves, Cmd/Ctrl+K palette, `g d` etc not required.
- Accessibility: same WCAG rules as public; focus moves to page `h1` on navigation.

### 8.2 Admin component inventory (`components/admin`)
`AdminShell, AdminSidebar, AdminTopbar, AdminCommand, QueryProvider (TanStack, defaults: staleTime 30s, retry 1 except 4xx), AuthGuard, DataTable (+ColumnHeader, Pagination, ViewOptions, BulkBar, RowActions), EntityListScreen, EntityFormScreen, PublishBar, StatusBadge, SlugField, FormField wrappers (TextField, TextAreaField, SelectField, SwitchField, TagsField, NumberField, DateTimeField, UrlField, PhoneField), RichTextEditor (Tiptap), MediaPicker (dialog with library + upload tab, single/multi), MediaField (preview, alt text, replace, remove), GalleryField (dnd-kit sortable), SortableList (generic), RepeaterField (array of objects with add/remove/reorder), RelationPicker (async multi-select combobox with search), SeoPanel (+SerpPreview, OgPreview, SeoScore), RevisionDrawer (+DiffView), ConfirmDialog, TypedConfirmDialog, UnsavedGuard, ImageCropper (crop + focal point), UploadQueue, EmptyState, ErrorState, StatCard, ActivityFeed, CopyButton, CsvExportButton, DateRangePicker, JsonEditor (for structured data override; textarea with validation)`.

### 8.3 Auth screens
All under `(auth)` layout: centered card, logo, no sidebar, `robots noindex`.

**Login `/admin/login`** ("Baraton Login"): fields Email (required, email), Password (required, show/hide toggle), "Forgot Password?" link, submit. `POST /admin/auth/login` sets httpOnly cookies. Response may be `{ requires2fa: true, challengeId }` -> step 2 with OTP (`input-otp`, 6 digits, "Use a recovery code" link). Errors: 401 generic "Invalid email or password" (never reveal which), 429 lockout "Too many attempts. Try again in {n} minutes", network error. After success: redirect to `next` param if it starts with `/admin` (open-redirect safe), else `/admin`.
**Forgot password `/admin/forgot-password`**: Email field; always shows "If an account exists, a reset link has been sent" (no enumeration). `POST /admin/auth/forgot-password`. Resend cooldown 60 s.
**Reset password `/admin/reset-password?token=`**: New Password, Confirm New Password (min 12 chars, strength meter, must match); `POST /admin/auth/reset-password`; invalid/expired token state with link to request a new one; success -> toast + redirect login.

### 8.4 Dashboard `/admin`
Widgets (from `GET /admin/dashboard`): 
- Stat cards: Published products, brands, services, posts; Unread messages; Messages this week (with delta); Draft items count; Missing-SEO count; Missing-alt-text media count.
- Messages chart (last 30 days, `chart` bar) and optional traffic summary if analytics API available (hidden otherwise).
- Recent messages (5, unread bold, link to inbox).
- Content status table: per entity type counts published/draft/scheduled with links to filtered lists.
- Recently edited (10 items with user/time) and "Scheduled to publish" list.
- Health checklist: sitemap last generated, robots OK, missing logo/favicon, 404 hits top 5 with "Create redirect" shortcut, broken YouTube link count.
- Quick actions: New product, New post, Upload media, Edit homepage, Revalidate cache (`POST /admin/cache/revalidate`, confirm).
States: each widget has its own skeleton/error so one failure does not blank the dashboard.

### 8.5 Site Settings `/admin/settings` (tabs, one form per tab, save per tab)
Endpoint `GET/PUT /admin/settings`.
1. **Branding**: `siteName` (req, <=60), `legalName`, `tagline` (<=120), `logoLight` (Media, req), `logoDark?`, `logoMark?` (square), `favicon` (square >=512 px PNG/SVG, validated client-side by dimensions), `ogDefaultImage` (1200x630 recommended), `themeColor` (hex), `defaultLocale`.
2. **Contact & Offices**: `offices[]` repeater: `name, country, addressLines[] (1-4), phones[] (each validated, max 5), email, hours, lat, lng, mapQuery, isPrimary (exactly one), isLocalBusiness`; `primaryEmail`, `whatsappNumber?`, `contactFormRecipients[]` (emails notified of new messages), `formSubjects[]`.
3. **Socials**: repeater `{platform: facebook|x|linkedin|instagram|youtube|tiktok|telegram|whatsapp, url (https), order}`; drives footer, JSON-LD `sameAs`.
4. **Header & CTA**: `headerCta {label, href, icon}` (default "Let's Talk" -> /contact, phone icon), `topbarEnabled`, `searchEnabled`.
5. **Footer text**: `footerBlurb` (<=300), `copyrightText` (supports `{year}` and `{siteName}` tokens), `legalLinks` (links to pages). **Credit decision: "Developed by Dagim Meseret" is NOT editable and NOT removable.** It is hard-coded in `SiteFooter` from the `DEVELOPER_CREDIT` constant. The Settings screen shows a read-only row "Developer credit: Developed by Dagim Meseret (fixed)" so the admin understands it is intentional. There is no setting, API field, or flag to hide it.
6. **Features**: `newsEnabled`, `faqEnabled`, `searchEnabled`, `captchaProvider (none|turnstile|recaptcha)` + site key, `thankYouRedirect`, `maintenanceMode` (shows maintenance page for public, admin unaffected).
7. **Analytics & Tags**: see 5.13 fields with format validation (`^G-[A-Z0-9]{6,12}$`, `^GTM-[A-Z0-9]{4,10}$`); "Test" helper links.
8. **Defaults for SEO**: `titleTemplate` (must contain `%s`), `defaultTitle`, `defaultDescription`, `twitterHandle`, `homeTitle`.
Dirty guard per tab; Save button disabled until dirty; success revalidates `settings`.

### 8.6 Navigation & Footer editor `/admin/navigation`
- Two tabs: **Header menu**, **Footer**.
- Header menu: tree editor with dnd-kit nested sortable (max depth 2; level-3 not allowed). Each item: `label` (req, <=30), `type` (link | dropdown | mega), `target` (internal picker: pages/products/brands/services/news/custom URL; custom URL must be relative or https), `openInNewTab`, `highlight`, `visible`, `megaSource` for mega. Add item, add child, delete, duplicate, Move up/down buttons (a11y). Live preview panel renders `MegaMenu` + `MobileNav` simulation. Default seeded: Home, About Us, Products (mega), Service, Contact Us.
- Footer tab: columns repeater (max 4) each `title`, links list (sortable) or `source: featuredProducts` with limit; blurb; socials toggle; bottom legal links; copyright text token preview.
- Save = `PUT /admin/navigation`; optimistic reorder inside the editor; broken-link validator flags targets that were deleted.

### 8.7 Homepage builder `/admin/homepage`
- Left: ordered list of sections (dnd-kit sortable) with: drag handle, icon, label, enabled `switch`, "Edit" button, duplicate (if `allowMultiple`), delete. "Add section" dialog lists registry types with description and thumbnail icon.
- Right/drawer: the selected section's `EditorForm` (fields per 7.3). Common: heading, subheading, theme, padding, anchorId.
- Section forms: `hero` (slides repeater: image picker, headline, subheadline, CTA labels/links, badge; or "Use featured products" switch + limit), `brandsMarquee` (source, manual brand multi-picker), `companyStory` (logo, paragraphs repeater, CTAs), `stats`, `featuredProducts`, `services`, `videos`, `testimonials`, `news`, `ctaBanner`, `richText`, `imageText`, `cardGrid`, etc.
- Top bar: Save draft, Publish, Preview (opens `/api/preview?path=/`), History, Reset to default layout.
- Validation: at least one enabled section; hero max 12 slides; each hero slide needs image with alt; CTA href validation; zod discriminated union on `type`.
- Optimistic toggle/reorder; whole layout saved as one document `PUT /admin/home` (with version).

### 8.8 Pages `/admin/pages` (generic CMS pages)
List columns: Title, Slug (`/{slug}`), Template, Status, Updated, Updated by; filters: status, template; search title/slug. Form: `title` (req 2-120), `slug` (reserved-slug validation), `template`, `bodyMarkdown` (RichTextEditor) or Sections tab (builder for `landing`), `showInFooter`/`showInHeader` quick toggles (create nav links), SEO tab, status/schedule. Permission: admin. Delete blocked for system pages (`privacy-policy`, `terms` can be unpublished but not deleted?) decision: deletable with confirm; nav links referencing it are flagged.

### 8.9 About content `/admin/about`
Single document (no list). Tabs: **Header** (title, intro, heroImage), **Story** (paragraphs repeater or rich text + timeline repeater `{year, title, description}`), **CEO message** (name, role, photo, bodyMarkdown), **Mission & Vision** (missionItems repeater (ui-strings 4 items), visionText, valuesItems), **Subsidiaries** (repeater with `name, country, description(markdown), highlights[], logo, slug anchor`; Baraton Trade PLC and Baraton Trade LLC seeded), **Capabilities** (list), **SEO**. Sections can be reordered with the same section builder (about uses registry types `ceoMessage, missionVision, subsidiaries, timeline, richText, stats, brandsMarquee, ctaBanner`).

### 8.10 Products
**Products list `/admin/products`**: columns: checkbox, Thumbnail, Title (link) + slug small, Brand, Category, Country (flag badge), Featured (switch, optimistic), Status, SEO score dot (red/amber/green), Updated, Row actions (Edit, View on site, Duplicate, Archive, Delete). Filters: status, category, brand, country, featured, "missing image", "missing SEO". Search: title/slug/sku. Bulk: publish, unpublish, set category, set featured, delete. Sort: title, updated, sortOrder. Drag reorder of `sortOrder` available when sorted by "Manual order".
**Product form `/admin/products/new` and `/admin/products/[id]`** (tabs):
| Tab | Fields and rules |
|---|---|
| Content | `title` (req 2-120), `slug`, `shortDescription` (req, 20-300; counter), `contentMarkdown` (RichTextEditor, req for publish, <= 50k chars), `features[]` (repeater strings, <= 10, each <= 140) |
| Media | `coverImage` (req to publish; alt req), `gallery[]` (GalleryField: multi-upload, drag reorder, per-image alt/caption, max 20, set as cover), `videoUrl` (YouTube URL validated, normalised to id; preview) |
| Specifications | `specs[]` repeater `{group?, label (req <=60), value (req <=200), unit?}` with sortable rows, bulk-paste from a two-column text/CSV, grouping |
| Downloads | `brochures[]` `{title (req), file (PDF/DOC, <= 20 MB via media library), language?}`, sortable |
| Details | `country` (combobox with ISO countries + free text allowed, normalised e.g. "Ockelbo, Sweden" -> country "Sweden"), `brand` (RelationPicker single), `category` (RelationPicker single, create-inline), `sku?`, `tags[]`, `showAvailability` switch |
| Relations | `relatedProducts[]` (RelationPicker multi, max 8; empty = auto by category/brand), `relatedServices[]`, `faq[]` repeater {question, answerMarkdown} |
| SEO | `SeoPanel` (8.14) |
Actions: Save draft, Publish, Schedule, Preview, Duplicate, Archive, Delete (confirm; shows count of inbound references), History. Unsaved guard, autosave. Empty list state: "No products found" + "Add your first product".
**Categories `/admin/products/categories`**: simple list + dialog form (`name` req, `slug`, `description` markdown, `image?`, `parent?` (1 level), `sortOrder`, `seo` mini panel); drag reorder; delete blocked when products attached unless "reassign to..." selected.

### 8.11 Brands/Companies, Services, Videos, Testimonials, FAQ, News
**Brands `/admin/brands`**: list columns Logo, Name, Country, Products count, Official agent badge, Video (ok/invalid icon), Status, Updated. Form fields: `name` (req), `slug`, `logo` (req, SVG/PNG/JPG <= 5 MB per ui-strings "Max file size: 5MB", alt), `country` (normalised), `shortDescription` (req 20-300), `descriptionMarkdown` (RichTextEditor), `youtubeUrl` (validated; invalid values like "a" blocked; normalised to embed id; live preview), `website` (https), `isExclusiveAgent`, `sortOrder`, `products` (read-only list of linked products, add via picker), SEO tab. Empty state "No companies found / Add your first Company".
**Services `/admin/services`**: list Image, Title, Features count, Status, Updated. Form: `title` (req), `slug`, `shortDescription` (req), `image`, `icon` (lucide icon name picker, optional), `features[]` (repeater "Add Service Feature", each <= 160, 1-12, sortable), `descriptionMarkdown`, `process[]`, relations (brands, products), `faq[]`, SEO. Empty "No services found / Add your first service".
**Videos `/admin/videos`**: list (thumbnail from YouTube id, title, source (YouTube), featured, order, status). Form (dialog): `title` (req), `youtubeUrl` (req, validated; fetches `oembed` through API for title/thumbnail suggestion), `description?`, `thumbnail?` override, `featured` (shown on home), `brandRef?`, `productRef?`, `sortOrder`. Drag reorder. 
**Testimonials `/admin/testimonials`**: fields `quote` (req 20-500), `authorName` (req), `authorRole?`, `company?`, `avatar?`, `rating?` (1-5 optional), `featured`, `sortOrder`, status. Dialog form + sortable list.
**FAQ `/admin/faq`**: groups (sortable) with items (sortable): `question` (req <=200), `answerMarkdown` (req, RichTextEditor-lite), `group`, status; used by `/faq`, FAQ blocks and Product/Service FAQ attachments. Inline edit with accordion UI.
**News `/admin/news`**: list Cover, Title, Tags, Author, Published at, Status, Updated; filters status/tag/date range. Form: `title` (req), `slug`, `excerpt` (req 50-300), `coverImage` (req to publish), `bodyMarkdown` (RichTextEditor), `tags[]` (TagsField w/ create), `author` (defaults to current admin display name, editable text), `publishedAt` (date-time; scheduled if future), `relatedProducts[]`, `readingTime` (auto), SEO. Tag manager as dialog list.

### 8.12 Media Library `/admin/media`
- Views: grid (default) / list toggle; left folder tree (create/rename/delete folder, nested to 2 levels; "All files", "Unfiled"); top: search by filename/alt, filter type (image, document, video, other), sort (newest, name, size), upload button + drag-drop zone over the whole page.
- Upload: multiple files; `UploadQueue` panel with per-file `progress` (XHR/fetch with progress via `XMLHttpRequest` or presigned PUT to MinIO: flow `POST /admin/media/uploads` -> returns presigned URL(s) -> browser PUT with progress -> `POST /admin/media/uploads/{id}/complete`; fallback multipart to API), cancel/retry per file, client checks: images <= 10 MB, docs <= 20 MB, MIME allow-list (`image/jpeg,png,webp,avif,svg+xml`, `application/pdf`, doc/docx/xls/xlsx), client-side image downscale option for > 4000 px.
- Item detail drawer: preview, filename, dimensions, size, MIME, folder (move), `alt` (required for images unless "Decorative" checked), `caption`, `title`, **usage** list ("Used in: Product Montabert, Home hero") from API, copy URL, replace file (keeps URL/id), crop & focal point tool (`ImageCropper`: pick aspect presets 1:1, 4:3, 16:9, 1.91:1 and click to set focal point `{x,y}` in 0-1, saved to media record), download, delete (blocked with message if in use unless "force", which warns).
- Bulk: multi-select -> move to folder, delete, add tags.
- Picker mode (`MediaPicker` dialog): same library with select, single/multi, upload inline, filter by type; returns `Media`.
- Empty state: "No media yet. Drag files here or click Upload". Error and quota states (API 413/415 messages mapped).
- Missing-alt filter chip "Needs alt text (n)".

### 8.13 Messages inbox `/admin/messages` and `/admin/messages/[id]`
- Two-pane layout desktop (list left, detail right per live site: "Select a message / Choose a message from the list to view details"); mobile: list then detail page.
- List: checkbox, unread dot, sender name, subject, preview (1 line), received time (relative), product chip if inquiry, status badge. Filters: status tabs (All, New, Read, In progress, Replied, Archived, Spam), date range, subject, "has product". Search: name/email/phone/message text. Pagination 25.
- Statuses: `new | read | in_progress | replied | archived | spam`. Opening a `new` message auto-marks `read` (optimistic).
- Detail: name, email (`mailto`), phone (`tel`), company, subject, product inquiry link (to product), message body (preserve line breaks, linkify safely), metadata (received at, IP truncated, user agent, page URL, captcha score), status select, internal notes (textarea, saved), actions: Reply via email (opens `mailto:` with subject prefilled), Mark spam, Archive, Delete (confirm), Print.
- Bulk actions: mark read/unread, set status, archive, mark spam, delete (typed confirm over 10), **Export CSV** (selected or all filtered: `GET /admin/messages/export?format=csv&filters`; columns id, receivedAt, name, email, phone, company, subject, product, message, status). 
- Empty: "No messages found". Realtime-ish: refetch every 60 s while the tab is focused + unread badge in sidebar.

### 8.14 SEO manager `/admin/seo` (tabs)
**Overview**: site-wide SEO health table (entity type, count, missing title, missing description, title too long, description out of range, missing alt, noindex count) with links to filtered lists; sitemap URL + last generated + "Ping/refresh"; top 404 paths.
**Per-entity SEO panel (`SeoPanel`, embedded in every entity form)**:
- Fields: `metaTitle` (counter, 50-60 ideal), `metaDescription` (counter 120-160 ideal), `canonicalUrl` (optional), `focusKeyword`, `noindex`, `nofollow`, `ogTitle`, `ogDescription`, `ogImage` (Media; 1200x630 hint), `structuredDataOverride` (JSON editor, collapsed "Advanced"), `includeInSitemap`.
- **SERP preview** (desktop/mobile toggle) rendering Google-like result with URL breadcrumb, truncation at pixel-approx widths (600 px title, 920 px desc desktop); **social preview** cards (Facebook/X).
- **Scoring hints** (client-side, non-blocking checklist with pass/warn/fail): title length, description length, focus keyword in title / description / slug / first paragraph / an `h2`, one cover image with alt, content length >= 300 words (products 150), internal links >= 1, image alts present, slug short (<= 5 words), no duplicate title (API `GET /admin/seo/duplicates` check), canonical valid. Aggregate score 0-100 with colour; hints list each failing rule with fix text.
**Redirects `/admin/seo/redirects`**: table: From, To, Type (301/302/410), Hits, Last hit, Source (manual/auto-slug/imported), Created; search; filters; row actions edit/delete; **Add redirect** dialog: `from` (relative path starting `/`, no query unless regex, <= 300 chars), `to` (relative or absolute https), `statusCode` (301 default, 302, 307, 308, 410 for gone), `isRegex` (advanced, with validation + test input), `note`. Validations: from != to, no loop/chain detection (shows resolved final target, blocks cycles), no conflict with existing rule, cannot redirect `/admin`. **Bulk import CSV** (from,to,code) with preview + errors, **export CSV**. "Suggested redirects" panel from logged 404s with one-click create.
**Robots & Sitemap**: robots.txt editor (textarea + validation, live preview of final output including forced lines, "Reset to default", indexing toggle warning when site-wide noindex), sitemap settings (include news, include categories, default changefreq/priority per type, exclusions list of paths), "Regenerate / revalidate sitemap" button, link to open `/sitemap.xml` and `/robots.txt`.
**Analytics & Tags**: same form as Settings tab 7 (single source: this tab is canonical; Settings tab 7 links here to avoid duplication).

### 8.15 Revisions / History
- Per-entity `RevisionDrawer` (button "History" in `PublishBar`) and global `/admin/revisions` (filterable by entity type/user/date).
- List: version number, timestamp, author, change summary (auto, e.g. "Changed: title, price..." from diff keys), status at save (autosave/draft/published).
- Actions: View (read-only render), **Compare** with current or another revision (side-by-side field diff; markdown diff by line, word highlights), **Restore** (confirm; restores as a new draft revision, not auto-published; toast "Revision restored as draft"). Endpoint `GET /admin/{type}/{id}/revisions`, `POST .../revisions/{rid}/restore`.
- Retention info shown (e.g. last 50 per entity). Empty: "No history yet".

### 8.16 Account (Users/Profile) `/admin/account`
Tabs:
- **Profile**: `displayName` (req), `email` (change requires current password + verification email), `avatar`.
- **Password**: current password, new password (min 12, strength meter via zxcvbn-lite, not equal to old), confirm; on success other sessions can be revoked (checkbox).
- **Sessions**: table of active sessions (device/browser, IP truncated, location approx, last active, current badge) with "Revoke" and "Revoke all others". `GET /admin/auth/sessions`, `DELETE /admin/auth/sessions/{id}`.
- **Two-factor auth (2FA)**: status; enable flow: show QR (data from `POST /admin/auth/2fa/setup`), enter 6-digit code to confirm (`input-otp`), then display 10 one-time recovery codes (copy/download; shown once); disable requires password + code; regenerate recovery codes.
- Only one admin user; no "invite user" UI in v1 (architecture allows `/admin/users` later; sidebar entry omitted).

### 8.17 Audit log `/admin/audit-log`
Read-only table: Time, Actor, Action (create/update/delete/publish/login/login_failed/password_change/settings_change/export/restore), Entity type, Entity (link), IP (truncated), Details (expandable JSON diff). Filters: action, entity type, date range, actor; search by entity id; export CSV. Pagination 50. Empty "No activity recorded".

---

## 9. Forms, validation, errors, auth flow

### 9.1 Validation catalogue (zod; messages in `messages/en.json`)
| Schema | Fields |
|---|---|
| `loginSchema` | email (email), password (min 1) |
| `forgotSchema` | email |
| `resetSchema` | token (string), password (min 12, max 128), confirm (== password) |
| `contactSchema` | see 6.8 |
| `productSchema`, `brandSchema`, `serviceSchema`, `videoSchema`, `testimonialSchema`, `faqItemSchema`, `postSchema`, `pageSchema`, `categorySchema` | fields and limits as in 8.10-8.11; each `.superRefine` for publish-time requirements (publish schema stricter than draft schema: `draftSchema` only needs title) |
| `seoSchema` | metaTitle <= 70, metaDescription <= 200, canonicalUrl url optional, structuredDataOverride parseable JSON |
| `redirectSchema` | from `^/`, to `^/|https?://`, statusCode enum |
| `settingsSchemas` | per tab |
| `mediaMetaSchema` | alt <= 200 (required unless decorative), caption <= 300 |
Shared primitives in `lib/validation/primitives.ts`: `slug, url(https), phone, youtubeUrl (accepts watch?v=, youtu.be, embed/, shorts; extracts 11-char id; rejects others), ethiopianOrIntlPhone, richTextMarkdown(maxLen)`.

### 9.2 API error contract and handling
- API errors follow RFC 7807-like JSON: `{ status, code, message, errors?: [{ field, message }], requestId }`. `lib/api/errors.ts` -> `ApiError`.
- Mapping: 400/422 -> field errors; 401 -> refresh flow (9.4); 403 -> "You do not have access" page; 404 -> not-found state; 409/412 -> conflict dialog; 413/415 -> upload specific message; 429 -> "Too many requests, wait {retryAfter}s"; 5xx/network -> toast "Something went wrong. Please try again." with requestId copy button in details.
- Public pages never show raw errors; they use error boundaries.
- Logging: `console.error` server-side with requestId; optional Sentry.

### 9.3 Toast patterns (sonner)
Success 4 s; error 8 s with close; loading toast for long ops (`toast.promise`) e.g. publishing, uploads; undo toast for deletes/archives; one toast per action; position bottom-right desktop, top-center mobile; `aria-live` polite.

### 9.4 Client auth flow (cookie sessions)
- Cookies (set by API): `bt_access` (httpOnly, Secure, SameSite=Lax, short TTL ~15 min, path `/`), `bt_refresh` (httpOnly, Secure, SameSite=Strict/Lax, path `/api/v1/admin/auth`, ~7-30 days, rotating). Frontend never reads tokens. CSRF: API requires header `X-CSRF-Token` read from non-httpOnly cookie `bt_csrf` on state-changing requests (double-submit); `adminClient` attaches it automatically.
- Browser requests to `/api/v1/*` go same-origin through the Next rewrite so cookies are first-party.
- `adminClient` fetch wrapper: on `401` with code `token_expired` -> single-flight `POST /admin/auth/refresh` (shared promise queue so parallel requests wait), then replay original request once; if refresh fails -> clear query cache, redirect to `/admin/login?next=<current>&reason=expired` with toast "Session expired".
- Server side (layouts/RSC): `readSession()` forwards incoming `cookie` header to `GET /admin/auth/me` (`cache: 'no-store'`); on 401 tries refresh by calling `/admin/auth/refresh` and forwarding returned `Set-Cookie` using `cookies().set` (done in a route handler `app/admin/session/refresh/route.ts` the layout redirects through, because RSC cannot set cookies) -> then redirect back; if still 401 -> `redirect('/admin/login?next=...')`.
- Logout: `POST /admin/auth/logout` -> clear query cache -> `/admin/login`.
- Idle timeout: 30 min inactivity warning dialog ("Stay signed in") using refresh; hard logout after warning ignored.
- `next` param sanitised: must match `^/admin(/|$)`.

---
## 10. Performance, accessibility, browser support, testing, acceptance

### 10.1 Performance rules (summary; budgets in 5.12)
Server Components by default; no public data fetching on the client; `next/dynamic` for admin-only heavy libs (Tiptap, Recharts, dnd-kit, cropper) loaded only on admin routes (separate route group chunks); `optimizePackageImports`; no moment/lodash full imports; fonts self-hosted via `next/font`; HTML caching via ISR + CDN/reverse-proxy `Cache-Control: s-maxage` headers honoured; `Link prefetch` on in-viewport links for main nav only; images per 2.3; third-party scripts deferred; admin never loaded by public visitors (route group isolation, verified by bundle analyser).

### 10.2 Testing strategy
| Layer | Tooling | Scope |
|---|---|---|
| Static | `tsc --noEmit`, ESLint (jsx-a11y), Prettier check | CI gate on every PR |
| Unit | Vitest | `lib/seo/*` (metadata builder, JSON-LD builders, URL helpers), `lib/utils/youtube.ts` (all URL variants incl. `watch?v=..&t=35s`, `embed/..?si=..`, invalid `a`), slug, validators, redirect-loop detector, country normaliser, HMAC verify for revalidate route |
| Component | Vitest + RTL + MSW | `ContactForm` (validation, honeypot, server errors), `ProductFilters`, `MegaMenu` keyboard, `SectionRenderer` (unknown type, disabled block), `Markdown` (heading shift, sanitisation), `SeoPanel` (counters/score), `DataTable`, `UnsavedGuard`, `SlugField`, `RepeaterField` |
| Contract | `openapi-typescript` regenerate in CI + `tsc`; MSW handlers generated from the OpenAPI examples | fails build on API drift |
| E2E | Playwright (Chromium, Firefox, WebKit; mobile Pixel 7 + iPhone 14 viewports) against docker-compose stack with seeded DB | public journeys, admin CRUD, auth, SEO assertions (meta, JSON-LD parse, sitemap, robots, redirects) |
| Accessibility | `@axe-core/playwright` on every route template (0 serious/critical), keyboard-only tests for menu/dialogs/carousel | |
| Performance | Lighthouse CI (mobile preset) with budgets from 5.12 | on home, products, product detail, brand detail, contact |
| Visual (optional) | Playwright screenshots against design spec baselines | |
| Security | `pnpm audit`, CSP report-only review, cookie flags checked in e2e | |
Coverage targets: unit/component >= 80% on `lib/` and `components/forms|admin` logic. E2E must cover every acceptance item marked [E2E].

### 10.3 Definition of done (per task)
Typed, no `any` in app code; lint/tsc clean; states (loading/empty/error) implemented; a11y checked; responsive checked at 360/768/1280; metadata + JSON-LD present for public routes; tests added; no console errors; Storybook not required.

### 10.4 Browser/device matrix
Chrome/Edge latest 2, Firefox latest 2, Safari 16+ and iOS Safari 16+, Samsung Internet latest, Android Chrome on low-end device (4x CPU throttle for INP). Viewports: 360, 390, 768, 1024, 1280, 1536.

### 10.5 ACCEPTANCE CHECKLIST
Format: ID | Route | Action | Expected result. [E2E] marks automated candidates; QA verifies all.

#### A. Global layout and navigation
1. `/` | Load page | Header shows logo, nav (Home, About Us, Products, Service, Contact Us), search trigger, "Let's Talk" CTA; footer shows brand blurb, Quick Links, Our Products, Contact Us, socials, copyright. [E2E]
2. Any public page | Press Tab once | "Skip to main content" link appears first and moves focus to `main` on Enter. [E2E]
3. Desktop | Hover/Enter on "Products" | Mega-menu opens with categories/brands/featured products; Esc closes and returns focus to trigger. [E2E]
4. Mobile 390 px | Tap hamburger | Sheet nav opens, focus trapped, accordion for Products, close on link click. [E2E]
5. Any page | Press `/` or Ctrl/Cmd+K | Search palette opens; typing "mont" shows Montabert under Brands/Products within 600 ms; Enter on result navigates. [E2E]
6. Footer | Inspect credit | Reads exactly "Developed by Dagim Meseret"; no "xyberlabs" anywhere in the site, HTML source or admin. [E2E]
7. Footer | Check phone/email | Phones are `tel:` links (3 numbers), email is `mailto:`, address shows Bole Road, Wollo Sefer, Addis Ababa, Ethiopia, P.O.Box 62716. [E2E]
8. Footer | "Our Products" column | Lists up to 5 featured products linking to `/products/{slug}`. 
9. Header | Click "Let's Talk" | Navigates to `/contact`.
10. Any page except home | View breadcrumb | Matches path hierarchy; last item not a link, `aria-current="page"`. [E2E]
11. Resize 320-1920 px | Any page | No horizontal scroll; header/footer adapt. [E2E]
12. Any page | Keyboard tab through | Focus ring visible on all interactive elements; no keyboard trap. [E2E]

#### B. Home
13. `/` | Load | Hero shows first product slide with counter "1/8" (or N), prev/next controls and pause button. [E2E]
14. `/` | Click next / thumbnail | Slide changes, counter updates, announced via live region.
15. `/` | Hover marquee | Brand logo marquee pauses; with reduced-motion it is static/scrollable. [E2E]
16. `/` | Click a brand logo | Navigates to `/brands/{slug}`.
17. `/` | Scroll to story | Shows 2007 Tata-Daewoo story text, "Learn more" -> `/about`, "Our Products" -> `/products`.
18. `/` | Featured Videos | Shows up to 6 facades with titles; no YouTube network request before click; click loads `youtube-nocookie.com` iframe and plays. [E2E]
19. `/` | Our Services | Lists Parts and Accessories and Maintenance and Service with links to `/services/{slug}`.
20. `/` | Admin disables a section, wait for revalidate | Section disappears on reload within 60 s. [E2E]
21. `/` | Empty section data (e.g. no testimonials) | Section not rendered, no empty heading.
22. `/` | View source | Exactly one `<h1>`; JSON-LD contains Organization, WebSite+SearchAction, LocalBusiness; title/description from CMS. [E2E]
23. `/` | Lighthouse mobile | Perf >= 90, A11y >= 95, SEO 100, LCP <= 2.5 s, CLS <= 0.1.

#### C. About
24. `/about` | Load | Sections in order: header, story, CEO message, mission/vision, subsidiaries (PLC, LLC), capabilities, CTA. [E2E]
25. `/about` | Click sub-nav "Baraton Trade LLC" | Scrolls to `#baraton-trade-llc` and highlights link; content remains in DOM without JS.
26. `/about` | Verify CEO text | Matches CMS (seed: "Since our company's founding in 2007...").
27. `/about` | Source | JSON-LD AboutPage + Breadcrumb valid.

#### D. Products
28. `/products` | Load | Grid of 8 seeded products, cards with image, country badge, title, short description, Read More, share. [E2E]
29. `/products` | Type "air" in search and submit | URL `?q=air`, only Air Compressor shown, result count announced, page `noindex`. [E2E]
30. `/products` | Filter Country = Japan | Only Japan products; URL has `country=japan`; canonical = `/products`; robots noindex,follow. [E2E]
31. `/products` | Clear filters | Returns to full list.
32. `/products?country=zzz` | Load | Empty state "No products found" with clear button; HTTP 200.
33. `/products` | > 12 products | Pagination links are anchors with `?page=2`; page 2 canonical self; title has "Page 2". [E2E]
34. `/products` | Throttle network | Skeletons shown (6 cards), no layout shift.
35. `/products` mobile | Tap Filters | Drawer opens with filters, Apply updates results.
36. `/products/category/{slug}` | Load | Own h1, description, indexable, in sitemap.
37. `/products/{slug}` | Load | h1 title, gallery, country badge, brand link, short description, CTA row. [E2E]
38. Product detail | Click gallery image | Lightbox opens, arrows and Esc work, focus restored on close. [E2E]
39. Product detail | Tabs | Overview markdown rendered with heading levels shifted (no extra h1); Specifications table; Downloads; all content in DOM. 
40. Product detail | Click "Download brochure" | File downloads; `file_download` event in dataLayer.
41. Product detail | Click "Request a quote" | Navigates to `/contact?product={slug}&subject=quote` and form shows chip "Inquiry about: {title}" with subject preselected. [E2E]
42. Product detail | Share button | Web Share or dropdown with copy link; copying shows toast.
43. Product detail | Related products | 4 items from the same category/brand, none equals current.
44. `/products/unknown-slug` | Load | 404 page with HTTP status 404 and noindex. [E2E]
45. Product detail | Source | JSON-LD Product (name, image, brand, description, additionalProperty), BreadcrumbList; validates in Rich Results Test; no fabricated price. [E2E]
46. Product detail | Source | `<title>` uses CMS metaTitle or title + template; canonical self; OG image present (dynamic or CMS).
47. Product without cover image | Load | Placeholder renders, no broken image icon.

#### E. Brands
48. `/brands` | Load | 9 brand cards with logos, country badge, short description; "Official agent" badge on Furukawa and Airman. [E2E]
49. `/brands` | Filter by country | List narrows; URL updates.
50. `/brands/montabert` | Load | Hero with logo, name, country; description; video facade (valid id); products section. [E2E]
51. Brand with invalid video value | Load | No video section rendered, no error.
52. `/brands/{slug}` | Source | JSON-LD Brand/Organization + VideoObject + Breadcrumb.
53. `/brands/{slug}` | Click CTA | `/contact?subject=partnership&brand={slug}` prefilled message mentions brand.

#### F. Services
54. `/services` | Load | 2 service cards with image, short description, first 3 features. [E2E]
55. `/services/parts-and-accessories` | Load | h1, features checklist (5 items), CTA to `/contact?service=...`, JSON-LD Service. [E2E]
56. `/services/maintenance-and-service` | Load | Features list shows "Predictive Maintenance" (typo corrected).

#### G. Contact
57. `/contact` | Load | Form (name, email, phone, company, subject, message, consent), info panel (address, 3 phones, email), socials, map facade. [E2E]
58. `/contact` | Submit empty | Field errors for name, email, message, consent; focus on first invalid; `aria-describedby` set. [E2E]
59. `/contact` | Invalid email "a@b" | Inline error "Enter a valid email address".
60. `/contact` | Message 5 chars | Error "Message must be at least 10 characters".
61. `/contact` | Valid submit | Button shows pending, success panel appears, toast, form reset, message visible in admin inbox as New within 5 s. [E2E]
62. `/contact` | Fill honeypot via script | API discards silently; UI shows success (no leak); no message in admin inbox. [E2E]
63. `/contact` | Submit within 2 s of load | Rejected as spam (no inbox entry).
64. `/contact` | API returns 429 | Message "Too many attempts. Please try again later."; values retained.
65. `/contact` | API offline | Error alert + toast; values retained; retry works.
66. `/contact` | Click "Load map" | Map iframe loads lazily with title; no Google request before click.
67. `/contact` | JS disabled | Form still submits through Server Action and shows result page.
68. `/contact` | Source | JSON-LD ContactPage + LocalBusiness with address and telephone.
69. `/contact?product=unknown` | Load | Ignores unknown product silently.

#### H. News, FAQ, pages, search, 404
70. `/news` | With posts | Featured post + grid, tag chips, pagination anchors. [E2E]
71. `/news` | No posts | "No news yet" and nav/footer link to news hidden (if auto-hide on).
72. `/news/{slug}` | Load | h1, meta (date `<time>`, author), cover, body, TOC for >= 3 h2, related posts, Article JSON-LD with dates. [E2E]
73. `/news/tag/{slug}` | Load | Filtered posts, indexable, own title.
74. `/faq` | Load | Accordion groups; keyboard toggles; FAQPage JSON-LD matches visible Q&A. [E2E]
75. `/privacy-policy` | Load | Generic page with legal template and updated date.
76. `/privacy-policy` | Draft status | 404 publicly; visible in preview mode only.
77. `/search?q=drill` | Load | Grouped results with counts; noindex; query preserved in input. [E2E]
78. `/search?q=` | Load | Prompt to search + popular links; no API error.
79. `/search?q=zzzzzz` | Load | "No results" + suggestions.
80. `/does-not-exist` | Load | Branded 404, HTTP 404, search box, links. [E2E]
81. `/product/{legacyId}` | Load | 301 to `/products/{slug}`. [E2E]
82. `/comapny/{legacyId}` | Load | 301 to `/brands/{slug}`. [E2E]
83. `/service`, `/about-us`, `/contact-us` | Load | 301 to `/services`, `/about`, `/contact`. [E2E]
84. Admin creates redirect `/old` -> `/about` | Visit `/old` after save | 301 within 60 s without redeploy. [E2E]
85. `/About/` | Load | 301 to `/about`.

#### I. SEO technical
86. `/sitemap.xml` | Fetch | Valid XML; contains home, static pages, all published products/brands/services/posts/pages with accurate `lastmod`; excludes noindex, drafts, search, admin. [E2E]
87. Sitemap | Publish a new product | Appears within 60 s (revalidate). [E2E]
88. `/sitemap.xml` | Image entries | Product URLs include `<image:image>` for cover/gallery.
89. `/robots.txt` | Fetch | Contains forced `Disallow: /admin`, `/api/`, `/search`, `Sitemap:` line, plus CMS rules. [E2E]
90. Staging (`ENABLE_INDEXING=false`) | robots + any page | `Disallow: /` and `noindex` meta/header.
91. Every indexable page | Source | Exactly one h1, unique `<title>` <= 60 chars rendered, meta description 120-160 chars, canonical absolute self, OG + Twitter tags. [E2E crawl]
92. Entity with SEO override in CMS | Load | Override values used for title, description, OG, canonical.
93. Entity marked noindex | Load | `<meta name="robots" content="noindex...">`, removed from sitemap.
94. Social debuggers | Share product URL | OG image 1200x630 renders title/logo; correct text.
95. `/products/{slug}/opengraph-image` | Fetch | 200 image/png, 1200x630.
96. JSON-LD | All templates | Parse as valid JSON; no `<` unescaped; Rich Results Test has no errors for Product, FAQ, Breadcrumb, Article.
97. Site-wide | Check `alternates` | No hreflang while single locale; no errors.
98. Favicons | `/favicon.ico`, `/apple-icon`, `/manifest.webmanifest` | 200, correct icons from CMS settings, theme-color meta present.
99. Admin pages | Response headers + meta | `X-Robots-Tag: noindex` and robots meta noindex. [E2E]
100. Preview mode | Open preview link | Draft content shown, banner visible, noindex; after exit shows published content. [E2E]
101. HTTP | Check `http://`, `www` | 301 to canonical https host (proxy-level).
102. Internal links | Crawl | No broken internal links, no redirect chains > 1, all images have alt (or are decorative). [E2E crawl]
103. Analytics | Set GTM id in CMS and accept consent | GTM loads after consent only; `generate_lead` fires on contact submit; without consent nothing loads. [E2E]
104. Search Console | Set verification code in CMS | `<meta name="google-site-verification">` present on home.
105. Core Web Vitals | Lighthouse CI | LCP <= 2.5 s, CLS <= 0.1, TBT low; budgets in 5.12 met on home, products, product detail, contact.

#### J. Admin: auth
106. `/admin` (logged out) | Visit | Redirect to `/admin/login?next=%2Fadmin`. [E2E]
107. `/admin/login` | Wrong password | Generic error, no field hint; after N attempts lockout message with time. [E2E]
108. `/admin/login` | Correct credentials | Cookies set httpOnly (not readable from JS), redirect to `next` or `/admin`. [E2E]
109. `/admin/login?next=https://evil.com` | Login | Redirects to `/admin` (not external).
110. `/admin/login` | With 2FA enabled | OTP step; wrong code error; recovery code works.
111. `/admin/forgot-password` | Any email | Same success message; email delivered only for valid account.
112. `/admin/reset-password?token=bad` | Load | Invalid/expired state with link to request new.
113. `/admin/reset-password?token=ok` | Mismatched confirm | Inline error; weak password rejected; success redirects to login.
114. Admin | Access token expires | Next API call auto-refreshes once, request succeeds with no visible interruption. [E2E]
115. Admin | Refresh fails | Redirect to login with "Session expired" toast and `next` preserved.
116. Admin | Sign out | Cookies cleared; back button does not reveal data (no-store).

#### K. Admin: dashboard & common patterns
117. `/admin` | Load | Stat cards, recent messages, content status, quick actions render; one widget failure does not break others.
118. List screens | Search/sort/filter/paginate | URL query updates; reload preserves state; server-side. [E2E]
119. List screens | Empty data | Empty state with "Add your first ..." button.
120. Edit screens | Edit then navigate away | Unsaved dialog; Keep editing / Discard work; browser reload shows native prompt. [E2E]
121. Edit screens | Cmd/Ctrl+S | Saves; toast; dirty flag cleared.
122. Edit screens | Two tabs edit same entity | Second save shows conflict dialog.
123. Edit screens | Server 422 | Errors mapped to fields, first invalid focused.
124. Delete | Confirm dialog | Cancel keeps item; confirm deletes with Undo toast (soft-delete) and public page 404 after revalidate. [E2E]
125. Toggles (featured/enabled) | Click | UI updates instantly; on API failure reverts with error toast.
126. Drag-and-drop lists | Reorder by mouse, keyboard, and Move up/down buttons | Order persists after reload. [E2E]

#### L. Admin: modules
127. Settings > Branding | Upload new logo, save | Header logo changes on public site within 60 s; file stored in MinIO; alt required.
128. Settings > Contact | Edit phone numbers | Footer and contact page update; invalid phone blocked.
129. Settings > Footer | Try to remove credit | No control exists; footer still shows "Developed by Dagim Meseret".
130. Settings > Analytics | Invalid GA4 id | Validation error; valid saves.
131. Navigation | Add child link, reorder, save | Public header reflects order; depth > 2 prevented; broken target flagged.
132. Footer editor | Change column links | Footer updates.
133. Homepage builder | Toggle, reorder, edit hero slide, publish | Public home reflects within 60 s; at least one enabled section enforced.
134. Homepage builder | Hero slide without alt | Publish blocked with message.
135. Pages | Create page with reserved slug "admin" | Validation error; valid slug publishes and appears in sitemap.
136. About | Edit CEO message and timeline | Public /about updates.
137. Products | Create with all tabs, publish | Appears on `/products` and sitemap; JSON-LD includes specs; brochure link works. [E2E]
138. Products | Publish without cover image | Blocked with field error.
139. Products | Change slug | Old URL 301s to new; notice shown before save.
140. Products | Bulk set category / delete | Applies to selected rows; typed confirm for delete > 10.
141. Products | Duplicate | New draft with "(Copy)" title and new slug.
142. Categories | Delete category with products | Blocked until reassign chosen.
143. Brands | Enter YouTube value "a" | Validation error; valid watch/embed/youtu.be URLs accepted and normalised; preview plays.
144. Brands | Upload logo > 5 MB | Rejected with message.
145. Services | Add/reorder features | Persist and show on public service page.
146. Videos | Add video URL | Thumbnail auto-fills; appears in home Featured Videos when featured.
147. Testimonials / FAQ | CRUD | Public blocks and FAQPage JSON-LD update.
148. News | Schedule post for future date | Hidden publicly until time; shows as Scheduled; then appears and enters sitemap.
149. Media | Upload 3 files | Progress bars per file, completes, thumbnails appear; wrong MIME rejected; > limit rejected.
150. Media | Set focal point & crop | Saved; images using it render with `object-position`.
151. Media | Delete in-use file | Warning with usage list; blocked unless forced.
152. Media | Missing alt chip | Filters images without alt.
153. Messages | Open new message | Becomes Read, unread badge decrements; detail shows all fields and product link.
154. Messages | Bulk archive + status change | Applied; filters show them under correct tab.
155. Messages | Export CSV | Download has header and correct columns/encoding (UTF-8 BOM) for filtered set.
156. Messages | Search by phone/email/text | Returns matching.
157. SEO panel | Type 80-char title | Counter turns warning; SERP preview truncates; score reflects.
158. SEO panel | Set focus keyword | Hints evaluate title/description/slug/first paragraph.
159. Redirects | Create loop A->B->A | Blocked with explanation; chain shows final target.
160. Redirects | CSV import with errors | Preview shows invalid rows; valid rows import.
161. Robots editor | Save custom rule | `/robots.txt` reflects within 60 s; forced lines remain.
162. Revisions | Edit and save twice, open History | Revisions listed; diff accurate; Restore creates draft revision, not live.
163. Account | Change password | Requires current; new session policy applied; weak rejected.
164. Account | Sessions | Lists current + others; revoke works; revoked session gets 401 -> login.
165. Account | Enable 2FA | QR, confirm code, recovery codes shown once; subsequent login requires OTP.
166. Audit log | Perform edits | Entries appear with actor, action, entity, IP; filters work; CSV export.
167. Revalidation | API publish event | `/api/revalidate` rejects bad signature (401) and old timestamp; valid call updates pages. [E2E]
168. Accessibility | axe on all public templates and admin screens | 0 serious/critical violations. [E2E]
169. Admin mobile 390 px | Use list and form screens | Sidebar in sheet, tables scroll within container, forms usable, sticky publish bar does not obscure fields.
170. Security | Cookies, headers | `HttpOnly; Secure; SameSite` on auth cookies; CSRF header required for writes; security headers present; no secrets in client bundle.

---

## 11. Implementation work breakdown

### 11.1 Phases and tasks
Legend: [P] can run in parallel with backend (uses mock API / generated types); [B] needs real backend endpoint; Dep = dependency IDs.

| Phase | ID | Task | Dep | Parallel w/ backend |
|---|---|---|---|---|
| **0 Foundations** | F1 | Create `apps/web` (Next 15, TS strict, Tailwind, ESLint, Prettier, husky), pnpm workspace wiring, Dockerfile (standalone), `.env.example`, env validation | - | [P] |
| | F2 | Install shadcn + components (2.1), `components.json`, design tokens stub in `globals.css` (values supplied by design spec), `next/font` setup | F1 | [P] |
| | F3 | OpenAPI pipeline: `scripts/gen-api.ts`, `lib/api/client.ts`, `errors.ts`, `tags.ts`; MSW mock server with fixtures from `docs/source/*.json` | F1 | [P] (uses draft OpenAPI from backend plan; regenerate when API ready) |
| | F4 | `lib/seo` (metadata builder, JSON-LD builders, urls), `JsonLd`, constants (`DEVELOPER_CREDIT`, reserved slugs), i18n `t()` | F1 | [P] |
| **1 Public shell** | P1 | Root layout, fonts, `SiteHeader` + `MegaMenu` + `MobileNav` + `SearchCommand` (mock), `SiteFooter` (+credit), `Breadcrumbs`, `SkipLink`, `PageHeader`, 404/error/loading, `CmsImage`, `Markdown` | F2-F4 | [P] |
| | P2 | Block registry + `SectionRenderer` + Home sections (hero, marquee, story, stats, featured products, services, videos, testimonials, news, cta) | P1 | [P] |
| | P3 | Home page wiring (`/`) + metadata + JSON-LD | P2 | [B] for real data |
| **2 Public content** | P4 | Products list + filters + pagination + category page; `ProductCard`, `ProductFilters` | P1 | [B] |
| | P5 | Product detail (gallery, lightbox, tabs, specs, downloads, FAQ, related, share, inquiry CTA) + OG image route | P4 | [B] |
| | P6 | Brands list/detail + `VideoFacade` + OG | P1 | [B] |
| | P7 | Services list/detail + OG | P1 | [B] |
| | P8 | About page (sections + sub-nav) | P2 | [B] |
| | P9 | Contact page: `ContactForm`, Server Action, captcha slot, honeypot, `MapEmbed`, prefill, thank-you | P1 | [B] `POST /public/contact-messages` |
| | P10 | News list/detail/tag, FAQ page, generic `[slug]` page, search page + suggest | P1 | [B] |
| **3 SEO & infra** | S1 | `sitemap.ts`, `robots.ts`, `manifest.ts`, favicon routes, OG default, hreflang helper | P3-P10 | [B] `/public/sitemap`, `/public/robots` |
| | S2 | Redirect resolution (build-time + not-found runtime), legacy rules, middleware (admin gate, x-pathname, lowercase/trailing slash) | P1 | [B] |
| | S3 | `/api/revalidate`, `/api/preview`, draft-mode fetch plumbing, `PreviewBanner` | F3 | [B] |
| | S4 | Analytics component, consent banner, `track()` events | P1 | [B] settings |
| | S5 | Performance pass (bundle analysis, CWV tuning), a11y pass, Lighthouse CI | P3-P10 | |
| **4 Admin core** | A1 | Admin shell, sidebar, topbar, command palette, `QueryProvider`, auth client (refresh queue, CSRF), `AuthGuard`, session RSC helper | F3 | [P] against mock auth |
| | A2 | Auth screens (login+2FA step, forgot, reset) | A1 | [B] |
| | A3 | Generic building blocks: `DataTable`, `EntityListScreen`, `EntityFormScreen`, `PublishBar`, form fields, `SlugField`, `RepeaterField`, `RelationPicker`, `UnsavedGuard`, `ConfirmDialog`, `RichTextEditor` (Tiptap), `SortableList` | A1 | [P] |
| | A4 | Media Library + `MediaPicker` + upload queue + cropper/focal | A3 | [B] media endpoints |
| | A5 | Dashboard | A3 | [B] |
| **5 Admin modules** | M1 | Products (+categories) | A3, A4 | [B] |
| | M2 | Brands, Services, Videos, Testimonials, FAQ | A3, A4 | [B] |
| | M3 | News + tags, Pages | A3, A4 | [B] |
| | M4 | Site Settings, Navigation & Footer editor | A3, A4 | [B] |
| | M5 | Homepage builder + About editor (section forms for every registry block) | A3, A4, P2 | [B] |
| | M6 | Messages inbox + CSV export | A3 | [B] |
| | M7 | SEO manager (SeoPanel in all forms, redirects, robots/sitemap, analytics tab) | M1 | [B] |
| | M8 | Revisions drawer + global history, Account (password/sessions/2FA), Audit log | A3 | [B] |
| **6 Hardening** | H1 | Playwright e2e suites for checklist 10.5, axe checks, visual baselines vs design spec | all | |
| | H2 | Content seeding/import verification (11.4), SEO pre-launch checklist 5.17, security headers/CSP enforce, Docker compose smoke test | all | |

Critical path: F1 -> F3 -> A1 -> A3 -> M-series; public track P1 -> P2 -> P3.. is independent of admin until data is real. Two developers/agents can split public (P*, S*) and admin (A*, M*) tracks after F*.

### 11.2 API contract assumptions (`/api/v1`)
Conventions: JSON; `Content-Type: application/json`; list responses `{ data: T[], meta: { page, pageSize, total, totalPages } }`; single `{ data: T }` or bare T (generated types decide; wrap in `lib/api/public.ts` so UI sees plain T); timestamps ISO-8601; ids are UUID/ObjectId strings; `?page&pageSize&sort=field:asc&q=&status=` for admin lists; errors per 9.2; `ETag`/`version` on admin entities; auth via cookies + `X-CSRF-Token`; Public API needs no auth, supports `?preview=1` only with preview token header.

**Public API (read-only, cacheable)**
| Method | Path | Returns |
|---|---|---|
| GET | `/public/settings` | site settings (branding, offices, socials, header CTA, footer, features, analytics ids, seo defaults) |
| GET | `/public/navigation` | `{ header: NavItem[], footer: FooterConfig }` |
| GET | `/public/home` | `{ seo, sections[] }` with relations expanded |
| GET | `/public/about` | about document with sections |
| GET | `/public/products` | list; query `q, country, category, brand, sort, page, pageSize` |
| GET | `/public/products/facets` | countries, categories, brands with counts |
| GET | `/public/products/{slug}` | product detail incl. related |
| GET | `/public/product-categories`, `/public/product-categories/{slug}` | |
| GET | `/public/brands`, `/public/brands/{slug}` | |
| GET | `/public/services`, `/public/services/{slug}` | |
| GET | `/public/videos` | featured/all videos |
| GET | `/public/testimonials` | |
| GET | `/public/faq` | groups with items |
| GET | `/public/news`, `/public/news/{slug}`, `/public/news/tags`, `/public/news/tags/{slug}` | |
| GET | `/public/pages/{slug}` | generic page |
| GET | `/public/contact` | contact page content + form settings |
| POST | `/public/contact-messages` | body per 6.8; 201/422/429 |
| GET | `/public/search?q&type&page` ; `/public/search/suggest?q` | |
| GET | `/public/sitemap` | entries (5.5) |
| GET | `/public/robots` | rules |
| GET | `/public/redirects` ; `/public/redirects/resolve?path=` | |
| POST | `/public/not-found-log` | `{path, referrer}` |
| GET | `/public/slugs/{type}` | all published slugs for `generateStaticParams` |

**Admin API (cookie auth, CSRF)**
| Area | Endpoints |
|---|---|
| Auth | `POST /admin/auth/login`, `/logout`, `/refresh`, `/forgot-password`, `/reset-password`; `GET /admin/auth/me`; `POST /admin/auth/2fa/{setup,verify,disable,recovery-codes}`; `GET/DELETE /admin/auth/sessions[/{id}]`; `POST /admin/auth/change-password` |
| Dashboard | `GET /admin/dashboard` |
| CRUD resources (`products, product-categories, brands, services, videos, testimonials, faq-groups, faq-items, news, news-tags, pages`) | `GET /admin/{r}` (list with filters), `POST /admin/{r}`, `GET/PATCH/DELETE /admin/{r}/{id}`, `POST /admin/{r}/{id}/publish`, `/unpublish`, `/schedule`, `/duplicate`, `/restore`, `PATCH /admin/{r}/reorder` (ids[]), `POST /admin/{r}/bulk` (action, ids, payload), `GET /admin/{r}/{id}/revisions`, `POST /admin/{r}/{id}/revisions/{rid}/restore` |
| Singletons | `GET/PUT /admin/settings`, `/admin/navigation`, `/admin/home`, `/admin/about` (with `version`) |
| Media | `GET /admin/media`, `POST /admin/media/uploads` (presign), `POST /admin/media/uploads/{id}/complete`, `PATCH/DELETE /admin/media/{id}`, `POST /admin/media/{id}/replace`, `GET /admin/media/{id}/usage`, folders `GET/POST/PATCH/DELETE /admin/media/folders` |
| Messages | `GET /admin/messages`, `GET/PATCH/DELETE /admin/messages/{id}`, `POST /admin/messages/bulk`, `GET /admin/messages/export` |
| SEO | `GET/POST/PATCH/DELETE /admin/redirects`, `POST /admin/redirects/import`, `GET /admin/redirects/export`, `GET /admin/seo/overview`, `GET /admin/seo/duplicates`, `GET/PUT /admin/seo/robots`, `GET/PUT /admin/seo/sitemap`, `GET /admin/seo/404-log` |
| Utility | `GET /admin/slug-check`, `POST /admin/preview-token`, `POST /admin/cache/revalidate`, `GET /admin/oembed?url=` (YouTube metadata), `GET /admin/audit-log` (+`/export`) |
| Webhook out | API -> `POST {WEB_URL}/api/revalidate` (4.4 contract) |

### 11.3 Revalidation tag mapping the API must emit
- Product change: `product:{slug}`, `products`, `product-category:{categorySlug}`, `home`, `sitemap`, plus `brand:{brandSlug}` and `search`.
- Brand: `brand:{slug}`, `brands`, `home`, `sitemap`. Service: `service:{slug}`, `services`, `home`, `sitemap`.
- Post: `post:{slug}`, `news`, `tag:{tag}`, `home`, `sitemap`. Page: `page:{slug}`, `sitemap`. FAQ: `faq`. Video: `videos`, `home`. Testimonial: `testimonials`, `home`.
- Settings/navigation: `settings`, `navigation`. Home/about singleton: `home`/`about`. Redirects: `redirects`. Robots: `robots`. Slug change: both old and new slug tags.

### 11.4 Seed/import and data normalisation (frontend-visible rules)
1. Seed content from `docs/source`: 8 products, 9 brands, 2 services, plus About/CEO/mission/vision/subsidiaries/footer/contact copy from `ui-strings.txt`. Cloudinary images re-uploaded to MinIO; any image that fails to download is left empty (UI placeholders handle it) and flagged in the dashboard "Missing images".
2. Normalise: country strings ("Tokyo,Japan" -> Japan; "Ockelbo, Sweden" -> Sweden; "sweden" -> Sweden; "Saitama, Japan" -> Japan; keep city in `city` field if present); YouTube values to 11-char ids (invalid "a" dropped); "Walter Geratebou" brand maps to product "Walter"; "Nakayama" brand relates to product "Nakayama crushers"; service typo "redictive" -> "Predictive"; markdown cleanup (stray `#### #####`, `\r\n`, empty headings, `FURKAWA` typo flagged for editor review not auto-changed).
3. Slugs generated from titles; legacy ids stored for the 301 resolver (5.11).
4. Default flags: Furukawa and Airman `isExclusiveAgent = true`; first 5 products `featured = true` (matches live footer: FURUKAWA Rock Drills, Air Compressor, Montabert, Monark, Carmix).
5. Offices seeded: Addis Ababa (Bole Road, Wollo Sefer; P.O.Box 62716; phones +251 911 514558, +251 911 175644, +251 114 709133; aboma.taye@gmail.com) and Baraton Trade LLC (Florida, USA; address to be completed by admin).

### 11.5 Open decisions already made (for the implementer)
- Markdown is the stored rich-text format; Tiptap bridges it.
- Developer credit is fixed in code, never CMS-editable.
- Filtered product lists are noindex; category pages are the indexable facets.
- Redirects are runtime-resolved via API in `not-found.tsx`, so CMS redirects take effect without redeploy.
- Auth cookies are httpOnly and managed only by the API; the browser reaches the API through a same-origin Next rewrite.
- Public pages never fetch on the client; admin pages never render on the server beyond the auth gate.
- Single language in v1 with i18n scaffolding.
