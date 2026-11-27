# Barathon Trading — Backend Plan

Status: planning document (no code). Audience: the engineer/implementer of `apps/api`, the frontend planner, and QA.
Scope of this file: NestJS API, PostgreSQL, MinIO, custom Passport.js auth, CMS data model, REST contract, ops design, tests, acceptance checklist, work breakdown.

Conventions used in this document:
- "MUST / SHOULD / MAY" are used in the RFC-2119 sense. Everything marked MUST is required for acceptance.
- All routes are shown relative to the API origin and always start with `/api/v1`.
- All timestamps are ISO-8601 UTC strings in the API and `timestamptz` in the database.
- All IDs are UUID v7 strings (`uuid(7)` in Prisma) unless stated otherwise.
- Code identifiers are `camelCase` in TypeScript/JSON, `snake_case` in SQL (mapped through Prisma `@map`/`@@map`).

---

## Table of contents

1. Goals, scope, non-goals, assumptions, CMS feature inventory
2. Tech stack, versions, application structure
3. Data model (entities, fields, indexes, relations), slug/soft-delete/ordering/i18n rules, seed plan
4. Authentication and security (custom Passport.js module)
5. File handling (MinIO) and image pipeline
6. REST API specification (public and admin)
7. Contact form pipeline
8. Non-functional design (performance, observability, backups, env vars, Docker/VPS layout)
9. Testing strategy and acceptance checklist
10. Implementation work breakdown and API contract summary (DTO shapes)

---

# 1. Goals, scope, non-goals, assumptions, CMS inventory

## 1.1 Goals

1. Rebuild baratongroup.com as a professional platform, "Barathon Trading", whose entire public content is editable by an Admin through a dashboard (CMS) without a developer.
2. Provide one NestJS REST API (`/api/v1`) that serves (a) a read-only, cacheable public API consumed by Next.js SSR/ISR and (b) an authenticated admin API consumed by the Next.js admin dashboard (`/admin`).
3. Replace the old site's weaknesses: broken Cloudinary images (screenshots show missing hero/brand images), typos in copy, no SEO control, no draft state, no audit trail, weak contact inbox.
4. Be deployable later as a single-VPS Docker Compose stack (api, web, postgres, minio, reverse proxy with TLS, backup job).
5. Be implementable by a smaller/faster model from this document alone: exact names, routes, enums, fields.

## 1.2 Scope (in)

- Public read API for every public page and widget (home, about, products, product detail, brand/company detail, services, videos, news, generic pages, contact, search, sitemap, robots, redirects).
- Admin CRUD API for every content type, with draft/scheduled/published states, ordering, revisions, SEO, media library, messages inbox, redirects, settings, audit log, dashboard, import/export.
- Custom auth module (Passport.js) for a single user type: `ADMIN`.
- Contact form pipeline with spam defence and email notification.
- Seed/migration of the existing JSON/text content (`docs/source/*`) with typo cleanup and asset import.
- Revalidation webhook to Next.js.
- Operational design: env vars, Compose layout, backups, health checks.

## 1.3 Non-goals (v1)

- No public user accounts, no registration, no social login, no customer portal, no e-commerce/cart/payments/prices (product pages are catalogue + inquiry only).
- No multi-role RBAC (only `ADMIN`; the `Role` enum exists so roles can be added later).
- No visual page builder with free-form HTML/JS injection (blocks are a fixed typed catalogue; no arbitrary script embed).
- No server-side video hosting/transcoding (videos are YouTube references).
- No real-time collaboration/locking beyond optimistic concurrency (`updatedAt`/`version` check).
- No Amharic content in v1 (data model is i18n-ready; Phase 8 adds it).
- No separate "published snapshot vs working draft" for already-published items: editing a PUBLISHED item changes it live on save; to stage changes the admin sets it to DRAFT (documented decision; revisions give rollback).
- No Redis in v1 (single instance; pg-boss on PostgreSQL for jobs; in-memory cache/throttle).

## 1.4 Assumptions

| # | Assumption |
|---|-----------|
| A1 | Single VPS, single API instance (so in-memory cache and in-memory rate-limit store are acceptable). If scaled out later, swap to Redis stores behind the same interfaces. |
| A2 | Next.js and the API are served from the same registrable domain via the reverse proxy: `https://<domain>/` -> web, `https://<domain>/api/*` -> api, `https://<domain>/media/*` -> MinIO public bucket. This makes cookies first-party (SameSite=Lax works, no cross-site CORS in production). |
| A3 | One or a few human admins (created via CLI). Low write volume, moderate read volume (cached). |
| A4 | Email goes out through an SMTP provider (any); no inbound email processing. |
| A5 | The legacy Cloudinary URLs in the source JSON may be dead or slow (screenshots show broken images). The seed MUST tolerate download failures and report them. |
| A6 | The contact email shown on the old site (`aboma.taye@gmail.com`) is seeded as a public contact channel exactly as-is; the admin can change it in the CMS. The notification recipient is configured separately (`CONTACT_NOTIFY_TO` env, overridable in Settings). |
| A7 | Social links (Facebook, X, LinkedIn, Instagram) have no known URLs in the source; they are seeded hidden with empty URL until the admin fills them. |
| A8 | The CEO's name and photo are not in the source text; the seed creates the CEO message record with the message text and leaves name/photo empty (admin fills them). The old screenshot photo is not downloadable by the seed. |
| A9 | Footer credit MUST read "Developed by Dagim Meseret" (stored as editable settings, default seeded). |
| A10 | Language: English only in v1. |

## 1.5 Existing site facts the API must preserve

- Routes on old site: `/`, `/about`, `/products`, `/product/:id`, `/service`, `/contact`, company detail page. The new routes are slug-based; the seed creates legacy redirects (`/product/<mongoId>` -> `/products/<slug>`, `/service` -> `/services`, `/company/<id>` -> `/brands/<slug>`; see 3.12).
- Navigation: Home, About Us, Products (dropdown listing the products), Service, Contact Us. Header also has a product search box and the "Let's Talk" CTA (phone icon).
- Home: hero carousel of products (1/8 counter, thumbnail strip), "Brands We Work With" logo marquee ("Trusted by industry leaders worldwide"), company-story block (logo + 3 paragraphs + "Learn more" and "Our Products" buttons), Featured Videos ("Discover our work through these immersive experiences"), Our Services.
- About: tab nav (CEO Message, Philosophy, Baraton Trade LLC, Baraton Trade PLC), CEO's Message (photo + quote), Mission (4 points), Vision paragraph, subsidiaries texts.
- Contact page: Contact Information panel (phones, email, address, "Follow Us" social icons) + form (name, email, phone, message, "Send Message").
- Footer: brand blurb, social icons (FB, X, LinkedIn, Instagram), Quick Links (About Us, Our Products, Our Services, Contact Us), Our Products (first 5 products), Contact Us block, copyright, developer credit.
- Old admin: products, services, companies CRUD, message inbox, login, forgot/reset password. New admin must be a strict superset.

## 1.6 CMS-managed features (every editable thing)

Legend: Page = where it appears. "Entity" = table in section 3. Everything below is editable through the admin API (section 6.3) and none is hard-coded in the frontend.

### 1.6.1 Global / site-wide

| # | Editable item | Entity / field | Notes |
|---|---------------|----------------|-------|
| G1 | Site name, legal name, tagline | `SiteSettings` | Used in title template, JSON-LD Organization |
| G2 | Logo (light bg), logo (dark bg), favicon, Apple touch icon, default OG image | `SiteSettings` -> `Media` | Favicon accepts PNG/ICO/SVG |
| G3 | Theme colors (brand primary/accent hex, theme-color meta) | `SiteSettings.brandColors` | Frontend may map to CSS variables |
| G4 | Header CTA ("Let's Talk"): label, link type (internal path / tel / mailto / url), href, icon name | `SiteSettings.headerCta` | |
| G5 | Header search: placeholder, enabled flag | `SiteSettings.search`, `UiString` | |
| G6 | Main navigation menu (items, order, nesting, visibility, open-in-new-tab) incl. dynamic "Products" dropdown (auto-list products, with cap) | `Menu`, `MenuItem` | Location `HEADER` |
| G7 | Footer: brand blurb, columns (Quick Links, Our Products dynamic, Contact), copyright text with `{year}` token, developer credit (text + name + URL) | `SiteSettings.footer*`, `Menu` (`FOOTER_QUICK`, `FOOTER_PRODUCTS`, `FOOTER_LEGAL`) | Default credit: "Developed by Dagim Meseret" |
| G8 | Social links (platform, URL, order, visible) | `SocialLink` | FACEBOOK, X, LINKEDIN, INSTAGRAM, YOUTUBE, TELEGRAM, TIKTOK, WHATSAPP |
| G9 | Contact channels (phones, emails, WhatsApp; label, value, order, visible, where shown) | `ContactChannel` | 3 phones + 1 email seeded |
| G10 | Office locations (name, address lines, P.O. Box, city, country, lat/lng, map embed URL (allow-listed), opening hours, primary flag) | `Office` | Seed: Addis Ababa head office; Florida (LLC) hidden until address supplied |
| G11 | Microcopy / UI strings (form labels, button labels, empty states, section headings that are not block-specific, success/error messages) | `UiString` (key/value, grouped) | Keys catalogued in 6.2.20 |
| G12 | Default SEO: title template, default description, default OG image, Twitter handle, `noindex` for whole site (staging) | `SiteSettings.seoDefaults` | |
| G13 | Analytics IDs (GA4 measurement ID, optional GTM ID, Search Console verification meta) | `SiteSettings.analytics` | IDs only, never raw scripts |
| G14 | Maintenance mode flag and message | `SiteSettings.maintenance` | Public API still works; frontend shows banner/page |
| G15 | Announcement bar (text, link, color variant, start/end datetime, visible) | `SiteSettings.announcement` | Optional top banner |
| G16 | Contact form settings (notify recipients, auto-reply on/off + text, consent checkbox on/off, success message, captcha provider) | `SiteSettings.contactForm` | |
| G17 | Robots.txt additional rules, sitemap exclusions/priorities/changefreq, `noindex` per entity | `SiteSettings.robots`, `SiteSettings.sitemap`, `SeoMeta` | |
| G18 | Redirects (301/302/307/308, exact or prefix) | `Redirect` | |
| G19 | Custom 404 copy (heading, text, CTA) | `UiString` keys `notFound.*` | |

### 1.6.2 Home page (system page `home`, composed of ordered blocks)

| # | Block / item | Editable fields |
|---|--------------|-----------------|
| H1 | Block list itself | Add/remove/reorder blocks, per-block `visible` toggle, anchor id, background variant, spacing variant |
| H2 | Hero carousel (`HERO_CAROUSEL`) | Source mode: `HERO_SLIDES` or `FEATURED_PRODUCTS`; autoplay ms; show thumbnails; show counter; slides managed in `HeroSlide` (image, mobile image, eyebrow, heading, subheading, up to 2 buttons, linked product/brand/URL, order, visible, schedule window) |
| H3 | Brands marquee (`BRANDS_MARQUEE`) | Title ("Brands We Work With"), subtitle ("Trusted by industry leaders worldwide"), all vs selected brands, order follows `Brand.sortOrder` or custom selection order, speed, link-to-brand toggle |
| H4 | Company story (`IMAGE_TEXT`) | Image (logo), heading, rich body (3 paragraphs), image position, up to 3 buttons ("Learn more", "Our Products") |
| H5 | Stats / counters (`STATS`) | Heading; stat items in `Stat` (value, suffix, label, icon, order) e.g. "Years of experience" |
| H6 | Featured products (`FEATURED_PRODUCTS`) | Title, subtitle, automatic (`isFeatured` flag) or hand-picked product IDs, limit, layout (`GRID`/`CAROUSEL`) |
| H7 | Featured videos (`VIDEOS_GRID`) | Title ("Featured Videos"), subtitle ("Discover our work through these immersive experiences"), featured vs selected, limit |
| H8 | Our services (`SERVICES_GRID`) | Title ("Our Services"), subtitle, all vs selected, limit, CTA button |
| H9 | Testimonials (`TESTIMONIALS`) | Title, selected or all published |
| H10 | Latest news (`LATEST_POSTS`) | Title, count, category filter |
| H11 | CTA banner (`CTA_BANNER`) | Heading, text, button(s), background image |
| H12 | Home SEO | `Page.seo` (title, description, OG, canonical, noindex, JSON-LD) |

### 1.6.3 About page (system page `about`)

| # | Block / item | Editable fields |
|---|--------------|-----------------|
| AB1 | Tab navigation | Each block has `showInTabNav` and `navLabel` (defaults: "CEO Message", "Philosophy", "Baraton Trade LLC", "Baraton Trade PLC"), `anchorId` |
| AB2 | CEO message (`LEADER_MESSAGE`) | `LeaderMessage`: heading ("CEO's Message"), name, job title, photo, message rich text (2 paragraphs), quote-style toggle, signature image |
| AB3 | Company story / history (`IMAGE_TEXT`) | Rich text from home story, reusable |
| AB4 | Timeline (`TIMELINE`) | `TimelineEntry`: year/label (2007, 2007-2024, 2019, Today), title, description, image, icon, order, visible |
| AB5 | Mission / Vision (`MISSION_VISION`) | Headings; Mission = ordered `CoreValue` items (group `MISSION`); Vision = rich text stored in the block `data.visionHtml` (+ title) |
| AB6 | Values (`CORE_VALUES`) | `CoreValue` group `VALUE` (title, description, icon, order); seeded as DRAFT (derived, see 3.13) |
| AB7 | Subsidiaries (`SUBSIDIARIES`) | `Subsidiary` entities (Baraton Trade LLC, Baraton Trade PLC): name, legal name, country, tagline, intro, body rich text, bullet lists, partner brands, logo, hero image, social/links, order, visible |
| AB8 | Group facts (`STATS`) | founded year, countries, etc. |
| AB9 | Team (`TEAM`) optional | `TeamMember` (name, role, photo, bio, order) - empty at launch |
| AB10 | About SEO | `Page.seo` |

### 1.6.4 Catalogue

| # | Item | Editable fields |
|---|------|-----------------|
| P1 | Product categories | `ProductCategory`: name, slug, description, image, parent (one level), order, visible, SEO |
| P2 | Brands / partner companies (the old "companies") | `Brand`: name, slug, logo (light), logo (dark, optional), country code, city, short description, rich description, website, YouTube links (via `Video`), partner type (`PRINCIPAL`, `PARTNER`), order, featured, status, SEO |
| P3 | Products | `Product`: title, slug, short description, rich content, hero image, country of origin (code + free text), brand, category(ies), featured flag, order, status/schedule, SEO |
| P4 | Product gallery | `ProductImage`: media, caption, alt override, order |
| P5 | Product specifications | `ProductSpec`: group, label, value, unit, order |
| P6 | Downloadable brochures / datasheets (PDF) | `ProductDocument`: title, file (public or private), language, size, order, download count |
| P7 | Related products | `ProductRelated` (manual) with automatic fallback (same category/brand) |
| P8 | Inquiry CTA per product | UI string + prefilled `ContactMessage.productId` |
| P9 | Services | `Service`: title, slug, short description, image/icon, rich body, features list (`ServiceFeature`: title, description, order), order, status, SEO |
| P10 | Videos | `Video`: title, description, YouTube URL (normalised to ID + start seconds), custom thumbnail, linked brand/product (optional), featured flag, order, status |

### 1.6.5 Marketing / editorial

| # | Item | Entity |
|---|------|--------|
| E1 | News/blog posts (title, slug, excerpt, cover, rich body, author name, categories, tags, publish date, status/scheduled, SEO) | `Post`, `PostCategory`, `Tag` |
| E2 | Generic pages (Privacy, Terms, any new page) built from blocks or a single rich-text block | `Page` (`isSystem=false`) + `PageBlock` |
| E3 | Testimonials (quote, person, company, role, photo, rating optional, order, visible) | `Testimonial` |
| E4 | FAQ (groups and Q&A, order; FAQ JSON-LD generated automatically) | `FaqGroup`, `Faq` |

### 1.6.6 Operations

| # | Item | Entity / API |
|---|------|--------------|
| O1 | Contact messages inbox with status (`NEW`, `READ`, `REPLIED`, `ARCHIVED`, `SPAM`), star, internal notes, reply by email, spam handling, CSV export | `ContactMessage`, `ContactMessageNote` |
| O2 | SEO per entity (title, description, OG title/description/image, canonical, noindex/nofollow, Twitter card, JSON-LD override) | `SeoMeta` |
| O3 | Redirects manager (+ CSV import, test tool) | `Redirect` |
| O4 | Sitemap / robots control | `SiteSettings.sitemap`, `SiteSettings.robots`, public endpoints |
| O5 | Media library (folders, alt text, caption, focal point, usage tracking, replace file, bulk delete) | `Media`, `MediaFolder`, `MediaVariant` |
| O6 | Audit log (who did what, when, diff) | `AuditLog` |
| O7 | Draft / published / scheduled / archived states + scheduled publishing job | `status`, `publishedAt`, `scheduledAt` on publishable entities |
| O8 | Content revisions (history, diff view data, restore) | `ContentRevision` |
| O9 | Import / export (JSON bundle of content + CSV for messages/redirects) | `/admin/export`, `/admin/import` |
| O10 | Dashboard stats (counts, unread messages, drafts, scheduled, recent activity, storage usage) | `/admin/dashboard` |
| O11 | Trash (soft-deleted items; restore; purge) | `deletedAt` |
| O12 | Manual cache revalidation | `POST /admin/revalidate` |
| O13 | Own account: profile, change password, sessions, 2FA | `/auth/*`, `/admin/me/*` |

---

# 2. Tech stack, versions, application structure

## 2.1 Decisions and justification

Versions are the targets at implementation time (pin exact versions in `pnpm-lock.yaml`; use the latest stable of the stated major).

| Concern | Decision | Version target | Why |
|---------|----------|----------------|-----|
| Runtime | Node.js LTS | 22.x | Active LTS, native fetch, stable test runner support |
| Language | TypeScript, `strict: true` | 5.6+ | Type safety across DTOs |
| Package manager / monorepo | pnpm workspaces (+ optional Turborepo) | pnpm 9+ | Monorepo layout `apps/api`, `apps/web`, `packages/*` |
| Framework | NestJS (Express adapter) | 11.x | Required; Express adapter chosen because Passport.js middleware ecosystem is Express-native |
| Database | PostgreSQL | 16 | JSONB for blocks, FTS (`tsvector`), `pg_trgm`, `citext`, mature backups |
| ORM / migrations | Prisma ORM + Prisma Migrate | 6.x | Typed client, declarative schema, migration SQL can be hand-extended (FTS indexes) |
| Validation (HTTP DTOs) | `class-validator` + `class-transformer` via global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) | latest | Native Nest + Swagger plugin integration |
| Validation (JSON blocks, settings JSON) | `zod` schemas, one per `BlockType` and per settings sub-object | 3.x | Discriminated unions for polymorphic JSON; shared with the frontend via `packages/contracts` |
| Config | `@nestjs/config` + zod-validated env schema (fail fast on boot) | latest | One typed `AppConfig` |
| API docs | `@nestjs/swagger` (OpenAPI 3.1), Swagger UI at `/api/docs` (disabled in production unless `SWAGGER_ENABLED=true`), JSON at `/api/v1/openapi.json` | 11.x | Generates TS client for frontend (`openapi-typescript`) |
| Auth | Passport.js: `passport`, `passport-local`, `passport-jwt`, `passport-custom` via `@nestjs/passport` | passport 0.7 | Required: custom auth on Passport |
| Password hashing | `argon2` (argon2id) | 0.4x | OWASP-recommended |
| TOTP | `otplib` + `qrcode` (QR returned as otpauth URI; QR rendered by frontend) | latest | Optional 2FA |
| Security headers | `helmet` | 8.x | |
| Rate limiting | `@nestjs/throttler` (in-memory store v1) | 6.x | Per-route named throttlers |
| Logging | `nestjs-pino` (+ `pino-pretty` dev only) | latest | JSON logs, request IDs, redaction |
| Jobs / queue / cron | `pg-boss` (Postgres-backed) + `@nestjs/schedule` not used | 10.x | No Redis needed; retries, scheduled jobs, singleton jobs, persistence across restarts |
| Email | `nodemailer` (SMTP) + Handlebars templates (`handlebars`) + plain-text fallbacks | 7.x | |
| Object storage | MinIO server + official `minio` JS SDK (S3 API) | minio-js 8.x | |
| Image processing | `sharp` (libvips) + `blurhash` | 0.34+ | WebP/AVIF, resize, EXIF rotate/strip |
| File sniffing | `file-type` (magic bytes) | latest | Never trust client MIME |
| SVG safety | `svgo` + `isomorphic-dompurify` (SVG profile) | latest | Logos often SVG (source has one) |
| HTML sanitization | `sanitize-html` with strict allow-list | latest | Rich text stored as HTML |
| Markdown -> HTML (seed only) | `marked` + sanitize | latest | Source product content is Markdown |
| Slugs | `slugify` (transliteration enabled) + own uniqueness service | latest | |
| Caching | `cache-manager` in-process LRU for public read models + HTTP `ETag`/`Cache-Control` | latest | |
| CLI | `nest-commander` | latest | `admin:create`, `seed`, etc. |
| IDs | UUID v7 (Prisma `uuid(7)`) | | Sortable, non-guessable |
| Testing | Jest + ts-jest, Supertest, Testcontainers (Postgres + MinIO) | | See section 9 |
| Lint/format | ESLint (typescript-eslint, `@typescript-eslint/no-floating-promises`), Prettier | | |
| Captcha | Cloudflare Turnstile (default) or hCaptcha, server-side verify via fetch | | Optional, env-driven |

Rejected alternatives (recorded so the implementer does not revisit): TypeORM (weaker typing of relations/JSON), Mongo (old site used it; relational + FTS is a better fit), Redis (not needed at this scale), Auth0/Clerk/NextAuth (explicitly forbidden), Cloudinary (replaced by MinIO + sharp), GraphQL (REST is simpler for ISR caching and tags).

## 2.2 Repository layout (monorepo)

```
/ (repo root)
  apps/
    api/                     # NestJS app (this plan)
    web/                     # Next.js app (frontend plan)
  packages/
    contracts/               # zod schemas + TS types shared with web (block schemas, enums, DTO types)
    config/                  # shared tsconfig/eslint presets
  docs/
    source/                  # legacy source material (read-only)
    plan/                    # backend-plan.md, frontend-plan.md
  deploy/
    compose.yml, compose.prod.yml, Caddyfile, backup/, minio-init/
  .env.example
```

`packages/contracts` is the single source of truth for: `BlockType` enum, per-block zod schemas, status enums, and public DTO TypeScript types. The API validates with it; the web imports its types.

## 2.3 NestJS app layout (`apps/api`)

```
apps/api/
  prisma/
    schema.prisma
    migrations/                       # incl. hand-written SQL for FTS/trigram/extension
    seed/
      index.ts                        # orchestrates seed
      data/
        site.json, menus.json, ui-strings.json, pages.home.json, pages.about.json,
        timeline.json, values.json, subsidiaries.json, faqs.json
        typo-fixes.json               # exact-match replacements (3.13.2)
        legacy-redirects.json
      assets-manifest.json            # generated by seed:assets (url -> mediaId)
  src/
    main.ts                           # bootstrap (helmet, cookie-parser, pino, versioning, swagger, shutdown hooks)
    app.module.ts
    cli.ts                            # nest-commander entry
    config/                           # env schema + typed config provider
    common/
      decorators/                     # @Public(), @CurrentUser(), @CurrentSession(), @Audit(), @ApiPaginated()
      filters/                        # AllExceptionsFilter (error format 6.1.4)
      interceptors/                   # ResponseCacheInterceptor, AuditInterceptor, SerializeInterceptor, TimeoutInterceptor
      pipes/                          # ParseUuidV7Pipe, SanitizeHtmlPipe(for @RichText fields)
      guards/                         # CsrfGuard, OriginGuard
      dto/                            # PaginationQueryDto, IdParamDto, ReorderDto, StatusChangeDto
      utils/                          # slug, html-sanitize, youtube, pagination, etag
      constants/                      # reserved slugs, route templates (path builder)
    prisma/                           # PrismaModule, PrismaService (soft-delete extension)
    storage/                          # MinioService (bucket init, put/get/remove/presign)
    mail/                             # MailModule (nodemailer transport, templates/*.hbs, EmailLog)
    jobs/                             # JobsModule (pg-boss wrapper, job names, handlers registry)
    cache/                            # CacheModule (LRU, tag invalidation)
    auth/                             # see 4
    audit/
    media/
    seo/
    settings/                         # SiteSettings, UiStrings
    navigation/                       # Menus, MenuItems
    contact-info/                     # ContactChannels, Offices, SocialLinks
    pages/                            # Pages + PageBlocks + block resolvers
    hero-slides/
    stats/
    timeline/
    core-values/
    leadership/                       # LeaderMessage, TeamMembers
    subsidiaries/
    brands/
    categories/                       # ProductCategory
    products/                         # Product, images, specs, documents, related
    services/
    videos/
    testimonials/
    faqs/
    posts/                            # Post, PostCategory, Tag
    contact/                          # public submit + admin inbox
    redirects/
    sitemap/                          # sitemap/robots generators
    revisions/
    revalidation/
    search/
    dashboard/
    import-export/
    health/
    preview/
    public/                           # thin public controllers aggregating read services (see 2.4)
    cli/                              # commands
  test/                               # e2e suites
  Dockerfile
```

Convention for each content module `X`:
```
x/
  x.module.ts
  x.admin.controller.ts      # @Controller('admin/xs') guarded by JwtAuthGuard + CsrfGuard
  x.public.controller.ts     # @Controller('public/xs') @Public(), cache interceptor
  x.service.ts               # write logic: validate, slug, sanitize, revision, audit, emit event
  x.read.service.ts          # public read models (projection to public DTO, caching)
  dto/create-x.dto.ts, update-x.dto.ts, query-x.dto.ts, x.response.dto.ts, x.public.dto.ts
  x.events.ts                # domain events: x.created/x.updated/x.published/x.deleted (-> revalidation, revisions, audit)
```

Domain events use `@nestjs/event-emitter` (in-process): `content.changed` with payload `{entityType, entityId, slug?, action, tags[]}`. Subscribers: `RevalidationService`, `RevisionsService` (if not inline), `SitemapCache`, `CacheService` (invalidate tags).

## 2.4 Module catalogue (controllers, services, DTOs)

| Module | Controllers | Services | Main DTOs (class names) |
|--------|-------------|----------|-------------------------|
| `config` | - | `AppConfigService` | `EnvSchema` (zod) |
| `prisma` | - | `PrismaService` (+ `softDelete` client extension: filters `deletedAt IS NULL` by default; `withDeleted()` for trash) | - |
| `storage` | - | `MinioService` (`ensureBuckets`, `putObject`, `removeObject`, `removePrefix`, `presignedGet`, `statObject`, `publicUrl(key)`) | - |
| `mail` | - | `MailService` (`send(template, to, data)`, logs `EmailLog`) | - |
| `jobs` | - | `JobsService` (`enqueue`, `schedule`, `work`) ; handlers: `send-email`, `revalidate`, `publish-scheduled`, `image-variants`, `purge-trash`, `purge-audit`, `purge-expired-tokens`, `media-orphans`, `sitemap-warm` | - |
| `cache` | - | `CacheService` (`wrap(key, tags, ttl, fn)`, `invalidateTags`) | - |
| `auth` | `AuthController` (`/auth/*`), `SessionsController` (`/auth/sessions`), `TwoFactorController` (`/auth/2fa/*`) | `AuthService`, `TokenService`, `SessionService`, `PasswordService`, `PasswordResetService`, `TwoFactorService`, `LockoutService`, `CsrfService` ; strategies `LocalStrategy`, `JwtStrategy`, `RefreshStrategy` ; guards `JwtAuthGuard`, `LocalAuthGuard`, `RefreshAuthGuard`, `RolesGuard` | `LoginDto`, `TotpLoginDto`, `ForgotPasswordDto`, `ResetPasswordDto`, `ChangePasswordDto`, `TwoFactorSetupVerifyDto`, `SessionResponseDto`, `MeResponseDto` |
| `audit` | `AuditAdminController` (`GET /admin/audit-logs`) | `AuditService.record()` | `AuditQueryDto` |
| `media` | `MediaAdminController`, `MediaFoldersAdminController` | `MediaService`, `ImageProcessor`, `SvgSanitizer`, `MediaUsageService`, `OrphanCleanup` | `UploadMediaDto`, `UpdateMediaDto`, `MediaQueryDto`, `MoveMediaDto`, `MediaResponseDto` |
| `seo` | (embedded in entity controllers) | `SeoService` (`upsertFor(entityType, id, dto)`, `resolve(entity)`, `jsonLd(entity)`) | `SeoMetaDto` |
| `settings` | `SettingsAdminController`, `SettingsPublicController` | `SettingsService`, `UiStringService` | `UpdateSiteSettingsDto` (+ nested), `UpsertUiStringsDto` |
| `navigation` | `MenusAdminController`, `MenusPublicController` | `MenusService` (tree build, dynamic item expansion) | `MenuDto`, `MenuItemDto`, `ReplaceMenuItemsDto` |
| `contact-info` | `ContactInfoAdminController` | `ContactChannelsService`, `OfficesService`, `SocialLinksService` | `ContactChannelDto`, `OfficeDto`, `SocialLinkDto` |
| `pages` | `PagesAdminController`, `PagesPublicController` | `PagesService`, `BlocksService`, `BlockResolverRegistry` + one resolver per `BlockType` | `CreatePageDto`, `UpdatePageDto`, `BlockDto` (validated by zod union), `ReorderBlocksDto` |
| `hero-slides` | admin only (read through page blocks) | `HeroSlidesService` | `HeroSlideDto` |
| `stats` | admin only | `StatsService` | `StatDto` |
| `timeline` | admin only | `TimelineService` | `TimelineEntryDto` |
| `core-values` | admin only | `CoreValuesService` | `CoreValueDto` |
| `leadership` | admin + public | `LeaderMessagesService`, `TeamMembersService` | `LeaderMessageDto`, `TeamMemberDto` |
| `subsidiaries` | admin + public | `SubsidiariesService` | `SubsidiaryDto` |
| `brands` | admin + public | `BrandsService` | `BrandDto`, `BrandQueryDto` |
| `categories` | admin + public | `CategoriesService` | `CategoryDto` |
| `products` | admin + public | `ProductsService`, `ProductImagesService`, `ProductSpecsService`, `ProductDocumentsService` | `ProductDto`, `ProductQueryDto`, `ProductImageDto`, `ProductSpecDto`, `ProductDocumentDto` |
| `services` | admin + public | `ServicesService` | `ServiceDto`, `ServiceFeatureDto` |
| `videos` | admin + public | `VideosService`, `YoutubeParser` | `VideoDto` |
| `testimonials` | admin + public | `TestimonialsService` | `TestimonialDto` |
| `faqs` | admin + public | `FaqsService` | `FaqGroupDto`, `FaqDto` |
| `posts` | admin + public | `PostsService`, `PostCategoriesService`, `TagsService` | `PostDto`, `PostQueryDto` |
| `contact` | `ContactPublicController` (`POST /public/contact`), `MessagesAdminController` | `ContactService`, `SpamService`, `CaptchaService` | `SubmitContactDto`, `UpdateMessageDto`, `ReplyMessageDto`, `MessageQueryDto` |
| `redirects` | admin + public (list for middleware) | `RedirectsService` (loop detection) | `RedirectDto`, `ImportRedirectsDto` |
| `sitemap` | `SitemapPublicController` | `SitemapService`, `RobotsService` | - |
| `revisions` | nested under each admin controller + `RevisionsAdminController` | `RevisionsService` | `RevisionResponseDto` |
| `revalidation` | `RevalidateAdminController` | `RevalidationService` (HMAC-signed webhook, debounced) | `RevalidateDto` |
| `search` | `SearchPublicController` | `SearchService` (FTS + trigram) | `SearchQueryDto` |
| `dashboard` | `DashboardAdminController` | `DashboardService` | - |
| `import-export` | `ImportExportAdminController` | `ExportService`, `ImportService` | `ImportBundleDto` |
| `health` | `HealthController` (`/health/live`, `/health/ready`) | `@nestjs/terminus` indicators (db, minio, jobs) | - |
| `preview` | `PreviewAdminController`, `PreviewPublicController` | `PreviewService` (signed short-lived token) | `CreatePreviewDto` |
| `cli` | - | commands: `AdminCreateCommand`, `AdminResetPasswordCommand`, `AdminUnlockCommand`, `Admin2faDisableCommand`, `SeedCommand`, `SeedAssetsCommand`, `DbCheckCommand`, `ExportCommand`, `ImportCommand` | - |

Global providers in `AppModule`: `APP_FILTER` AllExceptionsFilter; `APP_GUARD` order = `ThrottlerGuard`, `JwtAuthGuard` (skips `@Public()`), `CsrfGuard` (only unsafe methods on non-public routes), `RolesGuard`; `APP_INTERCEPTOR` = `AuditInterceptor` (only when `@Audit()` metadata present), `ClassSerializerInterceptor`; `APP_PIPE` = ValidationPipe.

Route prefix: global prefix `api`, URI versioning default `v1` => `/api/v1/...`. Public controllers use `@Controller({ path: 'public/...', version: '1' })`, admin `admin/...`, auth `auth/...`.

---

# 3. Data model

PostgreSQL 16, Prisma schema at `apps/api/prisma/schema.prisma`. Extensions created in the first migration: `pgcrypto`, `citext`, `pg_trgm`, `unaccent`.

## 3.1 Global rules

| Rule | Decision |
|------|----------|
| Primary key | `id String @id @default(uuid(7)) @db.Uuid` |
| Timestamps | `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` on every table (except append-only logs: only `createdAt`) |
| Actor tracking | Content tables carry `createdById`, `updatedById` (nullable FK -> `User`, `onDelete: SetNull`) |
| Soft delete | Content entities have `deletedAt DateTime?`. A Prisma client extension adds `deletedAt: null` to every `find*`/`count`/`aggregate` unless `withDeleted: true` is requested (admin trash endpoints). Hard delete only via `DELETE /admin/<res>/:id/purge` or nightly `purge-trash` job (items older than 30 days). Join/child rows (images, specs, features, menu items) are hard-deleted with the parent purge (`onDelete: Cascade`). Not soft-deleted: auth tables, logs, messages (messages use status `ARCHIVED`/`SPAM` + explicit hard delete), settings. |
| Publish workflow | Publishable entities have `status ContentStatus @default(DRAFT)`, `publishedAt DateTime?`, `scheduledAt DateTime?`. Public API returns only rows where `status = PUBLISHED AND deletedAt IS NULL AND (publishedAt <= now())`. |
| Ordering | `sortOrder Int @default(0)`; lists ordered by `sortOrder ASC, createdAt ASC`. Reorder endpoints rewrite `sortOrder` as 0..n-1 in one transaction. |
| Slugs | See 3.3 |
| Optimistic concurrency | `version Int @default(1)` on content entities, incremented on every update; admin update DTOs accept optional `expectedVersion`; mismatch => `409 VERSION_CONFLICT` |
| JSON columns | `Json @db.JsonB`; validated by zod before write; never trusted on read from admin imports |
| i18n readiness | See 3.4 |
| Money/prices | None |
| Text lengths | `@db.VarChar(n)` where bounded; rich text `@db.Text` |

## 3.2 Enums

```
enum Role            { ADMIN }
enum ContentStatus   { DRAFT SCHEDULED PUBLISHED ARCHIVED }
enum MessageStatus   { NEW READ REPLIED ARCHIVED SPAM }
enum MediaKind       { IMAGE SVG ICON DOCUMENT }
enum MediaVisibility { PUBLIC PRIVATE }
enum SocialPlatform  { FACEBOOK X LINKEDIN INSTAGRAM YOUTUBE TELEGRAM TIKTOK WHATSAPP }
enum ContactChannelType { PHONE EMAIL WHATSAPP FAX }
enum MenuLocation    { HEADER FOOTER_QUICK FOOTER_PRODUCTS FOOTER_LEGAL }
enum MenuItemType    { PAGE ENTITY CUSTOM DYNAMIC_PRODUCTS DYNAMIC_SERVICES DYNAMIC_BRANDS }
enum LinkTarget      { SELF BLANK }
enum BlockType       { HERO_CAROUSEL BRANDS_MARQUEE IMAGE_TEXT STATS FEATURED_PRODUCTS VIDEOS_GRID SERVICES_GRID
                       TESTIMONIALS LATEST_POSTS CTA_BANNER TIMELINE LEADER_MESSAGE MISSION_VISION CORE_VALUES
                       SUBSIDIARIES TEAM FAQ RICH_TEXT IMAGE_GALLERY CONTACT_STRIP BRAND_GRID }
enum CoreValueGroup  { MISSION VALUE }
enum BrandKind       { PRINCIPAL PARTNER }          // PRINCIPAL = official agency (Furukawa, Airman); PARTNER = others
enum DocumentLanguage{ EN AM }
enum RedirectType    { MOVED_301 FOUND_302 TEMP_307 PERM_308 }
enum RedirectMatch   { EXACT PREFIX }
enum EntityType      { PAGE PRODUCT PRODUCT_CATEGORY BRAND SERVICE POST POST_CATEGORY SUBSIDIARY VIDEO }   // SEO-capable entities
enum AuditAction     { CREATE UPDATE DELETE RESTORE PURGE PUBLISH UNPUBLISH SCHEDULE REORDER LOGIN LOGIN_FAILED LOGOUT
                       TOKEN_REFRESH REFRESH_REUSE_DETECTED PASSWORD_CHANGE PASSWORD_RESET_REQUEST PASSWORD_RESET
                       SESSION_REVOKE TWO_FA_ENABLE TWO_FA_DISABLE ACCOUNT_LOCKED ACCOUNT_UNLOCKED SETTINGS_UPDATE
                       IMPORT EXPORT REVALIDATE MESSAGE_STATUS MESSAGE_REPLY MEDIA_UPLOAD MEDIA_DELETE }
enum TwitterCard     { SUMMARY SUMMARY_LARGE_IMAGE }
```

## 3.3 Slug strategy

- Fields: `slug citext @unique` per table (case-insensitive unique). Allowed regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1-96 chars.
- Generation: if `slug` not supplied on create, derive from title via `slugify(title, {lower:true, strict:true, trim:true})` after `unaccent`. On collision append `-2`, `-3`, ... (loop until free, including soft-deleted rows because the unique index covers them).
- Reserved slugs rejected (409 `SLUG_RESERVED`) for pages and generic routes: `admin, api, about, products, product, brands, brand, services, service, news, contact, search, media, _next, sitemap, robots, favicon, login, 404, preview`. (Page slugs additionally must not equal any top-level app route.)
- Immutable by default after publish? No: editable. On slug change of a PUBLISHED entity the service MUST create an automatic redirect (`Redirect.auto = true`) from the old public path to the new one (path templates in 3.12.1) and collapse redirect chains (A->B->C becomes A->C).
- Lookup by slug is case-insensitive; the API returns the canonical lowercase slug.
- Slugs are not reused after soft delete until purge.

## 3.4 i18n readiness (English now, Amharic later)

- v1: all translatable text columns are English in the base table. Public API accepts `?locale=en` (only `en` valid; any other => 400 `UNSUPPORTED_LOCALE`) and returns `locale: "en"`.
- Phase 8 design (do not build in v1): per translatable entity a sibling table `<entity>_translations(id, <entity>Id FK cascade, locale varchar(5), <translatable fields...>, status, @@unique([entityId, locale]))`; the base table keeps English as the fallback; public queries `?locale=am` left-join with fallback to `en` per field; slugs per locale optional (`slug` stays shared by default); `SiteSettings.locales` (`['en']` -> `['en','am']`) and `defaultLocale` columns already exist in v1; `UiString` already has a `locale` column (default `en`) in its unique key so Amharic UI strings need no migration.
- Translatable fields list is recorded in the field tables below with the marker `[t]`.
- Fonts/RTL are not an issue (Amharic is LTR; Ethiopic script needs a Noto Sans Ethiopic font — frontend concern).

## 3.5 Entities: authentication

```
User
  id uuid PK
  email citext UNIQUE NOT NULL                    -- login id, lowercase-normalised
  name varchar(120) NOT NULL
  role Role NOT NULL default ADMIN
  passwordHash text NOT NULL                      -- argon2id encoded string
  passwordChangedAt timestamptz NOT NULL
  mustChangePassword boolean NOT NULL default false
  tokenVersion int NOT NULL default 0             -- bump to invalidate all access tokens
  isActive boolean NOT NULL default true
  failedLoginCount int NOT NULL default 0
  lockedUntil timestamptz NULL
  lastLoginAt timestamptz NULL
  lastLoginIp inet NULL
  totpSecretEnc text NULL                         -- AES-256-GCM(base32 secret), format "v1:iv:tag:ct" base64url
  totpEnabledAt timestamptz NULL
  avatarMediaId uuid NULL FK Media
  createdAt, updatedAt
  INDEX (isActive)

AuthSession                                       -- one row per login ("device session")
  id uuid PK
  userId uuid FK User ON DELETE CASCADE
  userAgent varchar(400) NULL
  deviceLabel varchar(120) NULL                   -- parsed "Chrome on Windows"
  ip inet NULL
  createdAt, lastUsedAt timestamptz
  idleExpiresAt timestamptz NOT NULL              -- sliding (default +14d, refreshed on rotation)
  absoluteExpiresAt timestamptz NOT NULL          -- hard cap (default +30d from login)
  revokedAt timestamptz NULL
  revokedReason varchar(40) NULL                  -- LOGOUT | LOGOUT_ALL | REUSE_DETECTED | PASSWORD_CHANGE | PASSWORD_RESET | ADMIN | EXPIRED
  INDEX (userId, revokedAt)

RefreshToken                                      -- rotating tokens inside a session (the "family" = session)
  id uuid PK
  sessionId uuid FK AuthSession ON DELETE CASCADE
  tokenHash char(64) UNIQUE NOT NULL              -- sha256 hex of the secret part
  parentId uuid NULL FK RefreshToken               -- previous token in chain
  issuedAt timestamptz NOT NULL
  expiresAt timestamptz NOT NULL                  -- = min(now + 14d, session.absoluteExpiresAt)
  usedAt timestamptz NULL                         -- set when rotated
  replacedById uuid NULL
  INDEX (sessionId), INDEX (expiresAt)

PasswordResetToken
  id uuid PK
  userId uuid FK User ON DELETE CASCADE
  tokenHash char(64) UNIQUE NOT NULL              -- sha256 of the emailed token
  expiresAt timestamptz NOT NULL                  -- +30 min
  usedAt timestamptz NULL
  requestIp inet NULL
  createdAt
  INDEX (userId), INDEX (expiresAt)

RecoveryCode                                      -- 2FA backup codes
  id uuid PK, userId FK cascade, codeHash char(64) (sha256 of normalised code), usedAt NULL, createdAt
  INDEX (userId)
```

Notes: no `Account`/`Session` tables from third-party libraries; no registration table. Multiple `User` rows are allowed (created only by CLI).

## 3.6 Entities: media

```
MediaFolder
  id, name varchar(80), parentId NULL FK self, sortOrder, createdAt, updatedAt
  UNIQUE (parentId, name)

Media
  id uuid PK
  kind MediaKind NOT NULL
  visibility MediaVisibility NOT NULL default PUBLIC
  bucket varchar(40) NOT NULL                     -- 'public-media' | 'private-docs'
  objectKey text NOT NULL UNIQUE                  -- original file key (see 5.3)
  originalName varchar(255) NOT NULL
  mimeType varchar(100) NOT NULL                  -- sniffed, not client-supplied
  sizeBytes bigint NOT NULL
  sha256 char(64) NOT NULL                        -- dedupe hint (INDEX); duplicates are allowed but flagged in the response
  width int NULL, height int NULL
  blurhash varchar(100) NULL
  dominantColor char(7) NULL                      -- '#rrggbb'
  lqip text NULL                                  -- data:image/webp;base64,... (<= 1.5 KB)
  alt varchar(300) NULL [t]
  caption varchar(500) NULL [t]
  title varchar(200) NULL
  focalX real NULL, focalY real NULL              -- 0..1 for art-directed crops
  folderId uuid NULL FK MediaFolder ON DELETE SET NULL
  processingStatus varchar(12) default 'READY'    -- PENDING | READY | FAILED (variants)
  uploadedById uuid NULL FK User
  createdAt, updatedAt, deletedAt
  INDEX (kind), INDEX (folderId), INDEX (sha256), INDEX (createdAt DESC)
  GIN index on to_tsvector('simple', coalesce(originalName,'')||' '||coalesce(title,'')||' '||coalesce(alt,'')) for library search

MediaVariant
  id, mediaId FK cascade, label varchar(20)       -- 'w320','w640','w960','w1280','w1920','thumb'
  format varchar(8)                               -- 'webp' | 'avif' | 'jpeg' | 'png'
  width int, height int, sizeBytes int, objectKey text UNIQUE
  UNIQUE (mediaId, label, format)
```
`Media` is referenced by many entities through nullable FK columns named `<field>MediaId`. "Usage tracking" is computed by the `MediaUsageService`, which queries all FK columns (list maintained in a constant `MEDIA_REFERENCES`) plus a scan of rich-text HTML for `/media/` keys (stored in `MediaRef` index table below to avoid scanning at request time).

```
MediaRef                                          -- reverse index maintained on every content save
  id, mediaId FK cascade, entityType varchar(40), entityId uuid, field varchar(60)
  UNIQUE (mediaId, entityType, entityId, field)
  INDEX (entityType, entityId)
```
Delete rules: deleting a `Media` that has `MediaRef` rows returns `409 MEDIA_IN_USE` with `usage[]` unless `?force=true` (then FKs are nulled).

## 3.7 Entities: SEO and settings

```
SeoMeta                                           -- 1:1 owned by an entity through entity.seoId
  id uuid PK
  metaTitle varchar(200) NULL [t]                 -- recommended <= 60 chars (UI hint), hard max 200
  metaDescription varchar(400) NULL [t]           -- recommended <= 160, hard max 400
  ogTitle varchar(200) NULL [t]
  ogDescription varchar(400) NULL [t]
  ogImageId uuid NULL FK Media
  twitterCard TwitterCard NOT NULL default SUMMARY_LARGE_IMAGE
  canonicalUrl varchar(500) NULL                  -- absolute https URL or site-relative path
  noindex boolean NOT NULL default false
  nofollow boolean NOT NULL default false
  keywords varchar(300) NULL                      -- optional, not emitted by default
  jsonLd jsonb NULL                               -- override; object or array of objects, each with "@context" containing "schema.org"; max 16 KB
  createdAt, updatedAt

SiteSettings                                      -- singleton row: id = 'singleton' (text PK) enforced by CHECK
  id text PK default 'singleton'
  siteName varchar(120) NOT NULL [t]              -- "Barathon Trading"  (seed: see 3.13)
  legalName varchar(200) NULL
  tagline varchar(200) NULL [t]
  logoLightMediaId, logoDarkMediaId, faviconMediaId, appleTouchIconMediaId, defaultOgImageMediaId uuid NULL FK Media
  brandColors jsonb NOT NULL                      -- { primary:'#2F3E7E', accent:'#8B3A47', themeColor:'#ffffff' }
  headerCta jsonb NOT NULL                        -- { enabled, label, hrefType:'PATH|TEL|MAILTO|URL', href, icon:'phone|arrow|none' } [t label]
  search jsonb NOT NULL                           -- { enabled:true, placeholder:'Search Products...' } [t]
  footerBlurb text NULL [t]
  copyrightText varchar(300) NOT NULL [t]         -- '(c) {year} Baraton Group Co. All rights reserved.' ({year} token)
  footerCredit jsonb NOT NULL                     -- { enabled, prefix:'Developed by', name:'Dagim Meseret', url:null }
  seoDefaults jsonb NOT NULL                      -- { titleTemplate:'%s | Barathon Trading', defaultTitle, defaultDescription, twitterHandle, siteNoindex:false }
  analytics jsonb NOT NULL                        -- { ga4Id:null, gtmId:null, searchConsoleVerification:null }
  maintenance jsonb NOT NULL                      -- { enabled:false, message:null }
  announcement jsonb NOT NULL                     -- { enabled, text, linkLabel, href, variant:'INFO|WARNING|PROMO', startsAt, endsAt }
  contactForm jsonb NOT NULL                      -- { notifyTo:[emails], autoReplyEnabled, autoReplyText, consentRequired, consentText, successMessage, captchaProvider:'NONE|TURNSTILE|HCAPTCHA' }
  robots jsonb NOT NULL                           -- { extraRules:string, disallow:[paths] }
  sitemap jsonb NOT NULL                          -- { excludeTypes:[EntityType], defaults:{changefreq,priority}, perType:{PRODUCT:{changefreq,priority},...} }
  locales text[] NOT NULL default '{en}', defaultLocale varchar(5) NOT NULL default 'en'
  updatedById, createdAt, updatedAt, version int

UiString                                          -- editable microcopy
  id, key varchar(120) NOT NULL, locale varchar(5) NOT NULL default 'en', value text NOT NULL, group varchar(40) NOT NULL, description varchar(200) NULL, updatedAt
  UNIQUE (key, locale)
```

## 3.8 Entities: contact info, navigation, redirects

```
ContactChannel
  id, type ContactChannelType, label varchar(60) NULL [t] ('Sales', 'Main line'), value varchar(160) NOT NULL (E.164-ish or email),
  displayValue varchar(160) NULL (as shown, e.g. '+251 911 514558'), isPrimary boolean, showOnContactPage boolean default true,
  showInFooter boolean default true, showInHeader boolean default false, sortOrder, visible boolean default true, createdAt, updatedAt

Office
  id, name varchar(120) [t], isPrimary boolean, addressLine1 varchar(200), addressLine2 varchar(200) NULL, poBox varchar(60) NULL,
  city varchar(100), region varchar(100) NULL, postalCode varchar(20) NULL, countryCode char(2), countryName varchar(80),
  latitude numeric(9,6) NULL, longitude numeric(9,6) NULL, mapEmbedUrl varchar(600) NULL (host allow-list: www.google.com/maps/embed, maps.google.com, www.openstreetmap.org),
  openingHours jsonb NULL ([{days:'Mon-Fri', open:'08:30', close:'17:30'}]), subsidiaryId NULL FK Subsidiary, sortOrder, visible, createdAt, updatedAt

SocialLink
  id, platform SocialPlatform (multiple rows per platform allowed), url varchar(500) NULL, label varchar(60) NULL,
  showInFooter default true, showOnContactPage default true, sortOrder, visible default false until url set (service enforces: cannot be visible without url)

Menu
  id, location MenuLocation UNIQUE, title varchar(80), updatedAt
MenuItem
  id, menuId FK cascade, parentId NULL FK self cascade (max depth 2 enforced in service), type MenuItemType, label varchar(80) [t],
  pageId NULL FK Page, entityType NULL EntityType, entityId NULL uuid, href varchar(500) NULL (for CUSTOM; path or https URL; tel:/mailto: allowed),
  target LinkTarget default SELF, icon varchar(40) NULL, config jsonb NULL (DYNAMIC_*: { limit:8, categoryId?:uuid, sort:'ORDER|NAME', showViewAll:true, viewAllLabel }),
  sortOrder, visible default true, createdAt, updatedAt
  INDEX (menuId, parentId, sortOrder)

Redirect
  id, sourcePath varchar(500) NOT NULL, matchType RedirectMatch default EXACT, targetPath varchar(1000) NOT NULL,
  type RedirectType default MOVED_301, auto boolean default false, enabled boolean default true, note varchar(200) NULL,
  hitCount int default 0, lastHitAt NULL, createdAt, updatedAt
  UNIQUE (sourcePath, matchType)   -- sourcePath stored normalised: leading '/', no trailing '/' (except root), lowercase, no query string
  INDEX (enabled)
```

## 3.9 Entities: pages and homepage composition

```
Page
  id, key varchar(40) UNIQUE NULL           -- system key: 'home','about'; NULL for custom pages
  slug citext UNIQUE NOT NULL               -- 'home' (path '/'), 'about' (path '/about'), 'privacy-policy' (path '/privacy-policy')
  title varchar(200) NOT NULL [t]
  isSystem boolean default false            -- system pages cannot be deleted or have slug changed; blocks editable
  template varchar(30) default 'DEFAULT'    -- 'HOME' | 'ABOUT' | 'DEFAULT' (frontend layout hint)
  heroTitle varchar(200) NULL [t], heroSubtitle varchar(500) NULL [t], heroImageMediaId NULL
  status ContentStatus, publishedAt, scheduledAt
  seoId uuid UNIQUE NULL FK SeoMeta
  showInSitemap boolean default true
  version, createdById, updatedById, createdAt, updatedAt, deletedAt

PageBlock
  id, pageId FK cascade
  type BlockType NOT NULL
  anchorId varchar(60) NULL                 -- HTML id for tab/scroll nav; unique per page (service-validated)
  navLabel varchar(60) NULL [t]             -- used when showInTabNav
  showInTabNav boolean default false
  visible boolean default true
  sortOrder int
  data jsonb NOT NULL                       -- validated by zod schema for `type` (see 3.9.1)
  createdAt, updatedAt
  INDEX (pageId, sortOrder)

HeroSlide
  id, eyebrow varchar(120) NULL [t], heading varchar(200) NOT NULL [t], subheading varchar(500) NULL [t],
  imageMediaId uuid NOT NULL, mobileImageMediaId NULL, overlayOpacity smallint default 40 (0..80),
  button1Label, button1Href, button2Label, button2Href (all varchar NULL) [t labels],
  productId NULL FK Product, brandId NULL FK Brand,     -- when set and button hrefs empty, frontend links to entity
  startsAt NULL, endsAt NULL, status ContentStatus default PUBLISHED, sortOrder, visible, version, createdAt, updatedAt, deletedAt

Stat
  id, value numeric(14,2) NOT NULL, prefix varchar(10) NULL, suffix varchar(10) NULL ('+','%'), label varchar(100) [t], icon varchar(40) NULL,
  group varchar(40) default 'GENERAL', sortOrder, visible, createdAt, updatedAt

TimelineEntry
  id, yearLabel varchar(30) NOT NULL ('2007','2007 - 2024','2019','Today'), startYear int NULL (sort helper), title varchar(160) [t],
  description text [t] (sanitized HTML), imageMediaId NULL, icon varchar(40) NULL, sortOrder, visible, createdAt, updatedAt, deletedAt

CoreValue
  id, group CoreValueGroup, title varchar(160) [t] (for MISSION items this is the sentence), description text NULL [t], icon varchar(40) NULL,
  sortOrder, status ContentStatus default PUBLISHED, createdAt, updatedAt, deletedAt

LeaderMessage
  id, heading varchar(120) default "CEO's Message" [t], name varchar(120) NULL, jobTitle varchar(120) NULL [t],
  photoMediaId NULL, signatureMediaId NULL, messageHtml text NOT NULL [t], isPrimary boolean default false (exactly one primary; enforced by partial unique index),
  status, sortOrder, version, createdAt, updatedAt, deletedAt

TeamMember
  id, name, jobTitle [t], bioHtml NULL [t], photoMediaId NULL, linkedinUrl NULL, sortOrder, status, createdAt, updatedAt, deletedAt
```

### 3.9.1 Block `data` schemas (zod; `packages/contracts/blocks.ts`)

Every block `data` also allows optional common keys: `title?: string(<=160)`, `subtitle?: string(<=300)`, `background?: 'DEFAULT'|'MUTED'|'DARK'|'BRAND'`, `spacing?: 'NONE'|'SM'|'MD'|'LG'`. Unknown keys are rejected (`.strict()`).

| BlockType | Specific `data` keys | Resolved by API into (public `resolved`) |
|-----------|----------------------|-------------------------------------------|
| `HERO_CAROUSEL` | `source: 'HERO_SLIDES'|'FEATURED_PRODUCTS'`, `autoplayMs: int 2000..20000 (default 6000)`, `showThumbnails: bool`, `showCounter: bool`, `limit: int 1..12` | `slides: HeroSlideDto[]` (when FEATURED_PRODUCTS, synthesized from published products with `isFeatured`, in `sortOrder`) |
| `BRANDS_MARQUEE` | `mode: 'ALL'|'SELECTED'`, `brandIds: uuid[]` (SELECTED order preserved), `speed: 'SLOW'|'NORMAL'|'FAST'`, `linkToBrand: bool`, `grayscale: bool` | `brands: BrandCardDto[]` |
| `BRAND_GRID` | `mode`, `brandIds`, `columns: 2..6` | `brands` |
| `IMAGE_TEXT` | `imageMediaId: uuid|null`, `imagePosition: 'LEFT'|'RIGHT'|'TOP'`, `heading: string`, `bodyHtml: string (sanitized)`, `buttons: {label, href, variant:'PRIMARY'|'SECONDARY'|'LINK', target}[] (max 3)` | `image: MediaDto|null` |
| `STATS` | `mode: 'ALL'|'SELECTED'`, `statIds: uuid[]`, `group?: string` | `stats: StatDto[]` |
| `FEATURED_PRODUCTS` | `mode: 'FEATURED_FLAG'|'SELECTED'|'CATEGORY'`, `productIds`, `categoryId?`, `limit 1..24`, `layout: 'GRID'|'CAROUSEL'`, `viewAllLabel?`, `viewAllHref?` | `products: ProductCardDto[]` |
| `VIDEOS_GRID` | `mode: 'FEATURED'|'SELECTED'|'ALL'`, `videoIds`, `limit 1..24`, `layout` | `videos: VideoDto[]` |
| `SERVICES_GRID` | `mode: 'ALL'|'SELECTED'`, `serviceIds`, `limit`, `ctaLabel?`, `ctaHref?` | `services: ServiceCardDto[]` |
| `TESTIMONIALS` | `mode`, `testimonialIds`, `limit`, `layout: 'CAROUSEL'|'GRID'` | `testimonials` |
| `LATEST_POSTS` | `limit 1..12`, `categoryId?`, `viewAllLabel?` | `posts: PostCardDto[]` |
| `CTA_BANNER` | `heading`, `text?`, `backgroundMediaId?`, `buttons[]` (max 2) | `backgroundImage` |
| `TIMELINE` | `mode: 'ALL'|'SELECTED'`, `entryIds`, `orientation: 'VERTICAL'|'HORIZONTAL'` | `entries: TimelineEntryDto[]` |
| `LEADER_MESSAGE` | `leaderMessageId: uuid` (or `null` => primary) | `leader: LeaderMessageDto` |
| `MISSION_VISION` | `missionTitle: string (default 'Mission')`, `visionTitle (default 'Vision')`, `visionHtml: string`, `missionMode: 'ALL'|'SELECTED'`, `missionIds` | `missionItems: CoreValueDto[]` |
| `CORE_VALUES` | `mode`, `valueIds`, `layout: 'CARDS'|'LIST'` | `values: CoreValueDto[]` (group VALUE, published only) |
| `SUBSIDIARIES` | `mode`, `subsidiaryIds`, `layout: 'TABS'|'STACKED'` | `subsidiaries: SubsidiaryDto[]` |
| `TEAM` | `mode`, `memberIds` | `members` |
| `FAQ` | `groupId?: uuid` (null => all groups) | `groups: FaqGroupDto[]` |
| `RICH_TEXT` | `html: string` | - |
| `IMAGE_GALLERY` | `images: {mediaId, caption?}[] (max 24)`, `columns 2..4` | `images: MediaDto[]` |
| `CONTACT_STRIP` | `showPhones, showEmail, showAddress: bool`, `buttonLabel`, `buttonHref` | `channels`, `offices` |

Referenced IDs that are unpublished/deleted are silently dropped from `resolved` (and flagged in the admin response `warnings[]`).

System page block layouts seeded (3.13.3): `home` and `about`.

## 3.10 Entities: catalogue

```
Brand                                             -- replaces legacy "company"
  id, name varchar(120) NOT NULL, slug citext UNIQUE, kind BrandKind default PARTNER,
  shortDescription varchar(600) [t], descriptionHtml text [t],
  logoMediaId NULL FK Media, logoDarkMediaId NULL, heroImageMediaId NULL,
  countryCode char(2) NULL, countryName varchar(80) NULL, city varchar(80) NULL,
  websiteUrl varchar(500) NULL, isFeatured boolean default false (shown in marquee when mode FEATURED? marquee uses sortOrder/ALL),
  showInMarquee boolean default true,
  legacyId varchar(24) NULL UNIQUE,                 -- Mongo _id from source (for redirects)
  sortOrder, status, publishedAt, scheduledAt, seoId UNIQUE NULL, version, createdById, updatedById, createdAt, updatedAt, deletedAt
  INDEX (status, sortOrder), INDEX (kind)

ProductCategory
  id, name varchar(120) [t], slug citext UNIQUE, description text NULL [t], imageMediaId NULL, parentId NULL FK self (max depth 1),
  sortOrder, status, publishedAt, seoId UNIQUE NULL, version, createdAt, updatedAt, deletedAt

Product
  id, title varchar(160) NOT NULL [t], slug citext UNIQUE, shortDescription varchar(600) NOT NULL [t],
  contentHtml text NOT NULL default '' [t] (sanitized HTML), heroImageMediaId NULL FK Media,
  brandId NULL FK Brand ON DELETE SET NULL, categoryId NULL FK ProductCategory ON DELETE SET NULL (primary category),
  extraCategoryIds uuid[] default '{}' (secondary; validated), countryCode char(2) NULL, countryName varchar(80) NULL, originCity varchar(80) NULL,
  isFeatured boolean default false, inquiryEnabled boolean default true, partNumber varchar(60) NULL, tagline varchar(200) NULL [t],
  legacyId varchar(24) NULL UNIQUE,
  searchVector tsvector GENERATED (see 3.11),
  sortOrder, status, publishedAt, scheduledAt, seoId UNIQUE NULL, version, createdById, updatedById, createdAt, updatedAt, deletedAt
  INDEX (status, sortOrder), INDEX (brandId), INDEX (categoryId), INDEX (isFeatured), GIN(searchVector), GIN(title gin_trgm_ops)

ProductImage        id, productId FK cascade, mediaId FK Media (restrict), caption varchar(300) NULL [t], altOverride varchar(300) NULL [t], sortOrder
ProductSpec         id, productId FK cascade, groupName varchar(80) NULL [t], label varchar(120) [t], value varchar(300) [t], unit varchar(30) NULL, sortOrder
ProductDocument     id, productId FK cascade, title varchar(160) [t], mediaId FK Media (kind DOCUMENT), language DocumentLanguage default EN,
                    visibility MediaVisibility default PUBLIC (mirrors media.visibility), downloadCount int default 0, sortOrder, createdAt
ProductRelated      productId FK cascade, relatedProductId FK cascade, sortOrder, PRIMARY KEY (productId, relatedProductId), CHECK (productId <> relatedProductId)

Service
  id, title varchar(160) [t], slug citext UNIQUE, shortDescription varchar(600) [t], bodyHtml text NULL [t],
  imageMediaId NULL, iconName varchar(40) NULL, ctaLabel varchar(60) NULL [t], ctaHref varchar(300) NULL,
  legacyId varchar(24) NULL UNIQUE, sortOrder, status, publishedAt, scheduledAt, seoId UNIQUE NULL, version, createdById, updatedById, createdAt, updatedAt, deletedAt
ServiceFeature      id, serviceId FK cascade, title varchar(200) [t], description varchar(500) NULL [t], sortOrder

Video
  id, title varchar(200) NOT NULL [t], description varchar(600) NULL [t],
  youtubeId char(11) NOT NULL, startSeconds int NULL, sourceUrl varchar(500) NOT NULL (as entered),
  thumbnailMediaId NULL, brandId NULL FK Brand SET NULL, productId NULL FK Product SET NULL,
  isFeatured boolean default false, sortOrder, status, publishedAt, version, createdAt, updatedAt, deletedAt
  INDEX (status, isFeatured, sortOrder), INDEX (youtubeId) (duplicates produce a warning, not an error)

Subsidiary
  id, name varchar(120) NOT NULL ('Baraton Trade LLC'), slug citext UNIQUE, legalName varchar(200) NULL, kind varchar(20) ('LLC'|'PLC'|'OTHER'),
  countryCode char(2), regionNote varchar(120) NULL ('Florida, USA'), tagline varchar(300) NULL [t], introHtml text [t], bodyHtml text NULL [t],
  lists jsonb NOT NULL default '[]'              -- [{ title:'Technological Solutions', style:'BULLETS'|'CHECKS'|'CHIPS', items:[string] }]
  logoMediaId NULL, imageMediaId NULL, websiteUrl NULL, sortOrder, status, publishedAt, seoId UNIQUE NULL, version, createdAt, updatedAt, deletedAt
SubsidiaryBrand     subsidiaryId FK cascade, brandId FK cascade, relation varchar(40) default 'EXCLUSIVE_RIGHTS' ('OFFICIAL_AGENT'|'EXCLUSIVE_RIGHTS'), sortOrder, PRIMARY KEY (subsidiaryId, brandId)
```

## 3.11 Search indexes (raw SQL in migration)

```sql
-- Product search vector (maintained by trigger because it joins brand/category names)
ALTER TABLE products ADD COLUMN search_vector tsvector;
CREATE INDEX products_search_idx ON products USING GIN (search_vector);
CREATE INDEX products_title_trgm_idx ON products USING GIN (title gin_trgm_ops);
-- trigger function products_refresh_search(): setweight(to_tsvector('simple', unaccent(title)),'A') ||
--   setweight(to_tsvector('simple', unaccent(coalesce(short_description,''))),'B') ||
--   setweight(to_tsvector('simple', unaccent(coalesce(brand.name,'') || ' ' || coalesce(category.name,'') || ' ' || coalesce(country_name,''))),'B') ||
--   setweight(to_tsvector('simple', unaccent(regexp_replace(content_html,'<[^>]+>',' ','g'))),'C')
-- Also refreshed (by the service, via a SQL function call) when a Brand/Category name changes.
```
`search_vector` is declared in Prisma as `Unsupported("tsvector")?`. Search service uses `$queryRaw` with `websearch_to_tsquery('simple', unaccent($q))` OR trigram `similarity(title, $q) > 0.3`, ranking `ts_rank_cd(search_vector, query) + similarity(title,$q)`. The same pattern (smaller) applies to `posts`, `brands`, `services` for the global search endpoint.

## 3.12 Entities: marketing, contact, ops

```
Testimonial   id, quote text [t], personName varchar(120), personRole varchar(120) NULL [t], companyName varchar(160) NULL, photoMediaId NULL, rating smallint NULL (1..5),
              sortOrder, status, publishedAt, createdAt, updatedAt, deletedAt
FaqGroup      id, title varchar(160) [t], slug citext UNIQUE, sortOrder, status, createdAt, updatedAt, deletedAt
Faq           id, groupId FK cascade, question varchar(300) [t], answerHtml text [t], sortOrder, status ContentStatus default PUBLISHED, createdAt, updatedAt, deletedAt

Post          id, title varchar(200) [t], slug citext UNIQUE, excerpt varchar(500) [t], bodyHtml text [t], coverMediaId NULL, authorName varchar(120) NULL,
              categoryId NULL FK PostCategory SET NULL, readingMinutes smallint (computed on save), isFeatured boolean,
              status, publishedAt (editable; also the displayed date), scheduledAt, seoId UNIQUE NULL, version, createdById, updatedById, createdAt, updatedAt, deletedAt
              INDEX (status, publishedAt DESC), GIN title trigram
PostCategory  id, name varchar(80) [t], slug citext UNIQUE, description NULL, sortOrder, seoId NULL, createdAt, updatedAt, deletedAt
Tag           id, name varchar(60), slug citext UNIQUE
PostTag       postId FK cascade, tagId FK cascade, PRIMARY KEY (postId, tagId)

ContactMessage
  id uuid PK, reference varchar(14) UNIQUE ('BT-' + yymmdd + '-' + 4 base36 chars)
  name varchar(120) NOT NULL, email citext NOT NULL, phone varchar(40) NULL, message text NOT NULL (<= 5000), subject varchar(160) NULL,
  productId NULL FK Product SET NULL, productTitleSnapshot varchar(160) NULL, sourcePath varchar(300) NULL,
  consentGiven boolean NULL, locale varchar(5) default 'en',
  status MessageStatus default NEW, isStarred boolean default false,
  spamScore smallint default 0, spamReasons text[] default '{}',
  ip inet NULL (stored in full; truncated to /24 after 90 days by job), userAgent varchar(400) NULL,
  readAt NULL, repliedAt NULL, handledById NULL FK User, archivedAt NULL, notificationStatus varchar(12) default 'PENDING' ('PENDING'|'SENT'|'FAILED'),
  createdAt, updatedAt
  INDEX (status, createdAt DESC), INDEX (isStarred), INDEX (email), GIN full-text on name||email||message
ContactMessageNote   id, messageId FK cascade, authorId FK User SET NULL, body text (<=2000), kind varchar(10) ('NOTE'|'REPLY'), createdAt

ContentRevision
  id, entityType varchar(40) (table-level name: 'PAGE','PRODUCT','BRAND','SERVICE','POST','SUBSIDIARY','SITE_SETTINGS','LEADER_MESSAGE','MENU',...), entityId uuid,
  versionNo int, snapshot jsonb NOT NULL (full serialised admin DTO incl. children and seo), changeNote varchar(200) NULL,
  authorId NULL FK User SET NULL, createdAt
  UNIQUE (entityType, entityId, versionNo), INDEX (entityType, entityId, createdAt DESC)
  Retention: keep last 50 per entity.

AuditLog
  id bigserial PK, actorId NULL FK User SET NULL, actorEmail varchar(255) NULL (denormalised), action AuditAction, entityType varchar(40) NULL, entityId varchar(64) NULL,
  summary varchar(300), diff jsonb NULL (changed top-level fields {field:[old,new]}; secrets/hashes never included; rich text truncated to 500 chars each side),
  ip inet NULL, userAgent varchar(400) NULL, requestId varchar(40) NULL, createdAt
  INDEX (createdAt DESC), INDEX (actorId), INDEX (entityType, entityId), INDEX (action)

RevalidationLog   id bigserial, tags text[], paths text[], status varchar(10) ('OK'|'FAILED'), httpStatus int NULL, attempts int, error text NULL, createdAt
EmailLog          id, template varchar(60), toAddress varchar(255), subject varchar(200), status varchar(10) ('QUEUED'|'SENT'|'FAILED'), providerMessageId varchar(200) NULL, error text NULL, createdAt
```
pg-boss creates its own schema `pgboss` (do not model in Prisma).

### 3.12.1 Public path templates (single constant `ROUTES` in `common/constants/routes.ts`, mirrored in contracts)

| Entity | Public path |
|--------|-------------|
| Page `home` | `/` |
| Page `about` | `/about` |
| Page (custom) | `/{slug}` |
| Products index | `/products` ; Product `/products/{slug}` ; Category `/products?category={slug}` (and `/products/category/{slug}` MAY be adopted by frontend; sitemap uses `/products/category/{slug}`) |
| Brands index | `/brands` ; Brand `/brands/{slug}` |
| Services index | `/services` ; Service `/services/{slug}` |
| News index | `/news` ; Post `/news/{slug}` ; Post category `/news/category/{slug}` |
| Subsidiary | `/about#{slug}` (anchor on about page; sitemap excludes) |
| Contact | `/contact` ; Search `/search?q=` |

## 3.13 Seed plan (mapping the existing content)

Seed is idempotent (upsert by natural key: `slug`, `key`, `legacyId`, `(key,locale)`), run by `pnpm --filter api cli seed` (data) then `cli seed:assets` (downloads images). `seed` never overwrites rows the admin has edited unless `--force` (it only inserts when the natural key is missing; for singletons only when the row is absent). A `seed-report.json` is written (created / skipped / typo-fixed / asset-failed lists).

### 3.13.1 Source -> model mapping

| Source | Target | Mapping rules |
|--------|--------|---------------|
| `product.json` (8 items) | `Product` | `_id` -> `legacyId`; `title` -> `title`; slug from title; `shortDescription` -> `shortDescription` (typo-fixed; trimmed to <=600 chars at a sentence boundary only if longer, report it); `image` -> download -> `Media` -> `heroImageMediaId`; `country` -> `countryCode`/`countryName`/`originCity` via table 3.13.4; `content` (Markdown) -> HTML (`marked`) -> sanitize -> `contentHtml` (first `# H1` equal to title is stripped because the page already has a title); `createdAt` -> `createdAt` and `publishedAt`; status `PUBLISHED`; `sortOrder` = source order; `isFeatured = true` for all 8 (they feed the hero carousel exactly as the old site did). |
| product -> brand link | `Product.brandId` | FURUKAWA Rock Drills -> Brand "Furukawa Rock Drill Co."; Air Compressor -> "AIRMAN"; Montabert -> Montabert; Monark -> Monark; Carmix -> Carmix; Elsasser -> Elsasser; Walter -> "Walter Gerätebau"; Nakayama crushers -> Nakayama. |
| product -> category | `Product.categoryId` | Categories created by seed (`ProductCategory`): "Rock Drills" (Furukawa), "Air Compressors" (Air Compressor), "Hydraulic Drilling Attachments" (Montabert), "Drilling Accessories" (Monark), "Concrete Equipment" (Carmix), "Filtration" (Elsasser), "Industrial Cleaning" (Walter), "Crushing & Screening" (Nakayama). Editorial assignment; admin may change. |
| `company.json` (9 items) | `Brand` | `_id` -> `legacyId`; `company_name` -> `name` (cleaned: "Sumitomo construction machinery CO.LTD" -> "Sumitomo Construction Machinery Co., Ltd."; "Walter Geratebou" -> "Walter Gerätebau"; "Furukawa Rock Drill Co" -> "Furukawa Rock Drill Co., Ltd."); `company_short_discription` -> `shortDescription`; `company_description` (plain text with `\r\n\r\n`) -> paragraphs -> `<p>` HTML (`descriptionHtml`); `logo_image` -> download -> `logoMediaId` (formats seen: jpg, svg, webp, ico, png); `company_country` -> `countryCode`/`city` (table 3.13.4); `kind`: Furukawa and AIRMAN = `PRINCIPAL` (official agency, per about text), others `PARTNER`; `showInMarquee = true`; `sortOrder`: Furukawa, AIRMAN, Montabert, Monark, Carmix, Elsasser, Walter, Nakayama, Sumitomo. |
| `company_youtubeLink` | `Video` | One `Video` per brand with a valid link. Parser extracts 11-char ID and `start` (`t=35s` -> 35). `Walter Geratebou` has value `"a"` -> invalid -> skipped and listed in seed report. Title = "{Brand name} overview"; `brandId` set; `isFeatured = true`; `sortOrder` follows brand order. Result: 8 videos. |
| `service.json` (2) | `Service` + `ServiceFeature` | `_id` -> `legacyId`; slug from title ("parts-and-accessories", "maintenance-and-service"); image -> Media; each `contentList` string trimmed (`\r\n` removed) and split on the first " – " / " - " into `title` and `description` (e.g. title "Drill Bits", description "The cutting tool used to penetrate surfaces."); `Predictive Maintenance` typo fixed. |
| `ui-strings.txt` (public copy) | `UiString`, `Page(home/about)` blocks, `LeaderMessage`, `CoreValue`, `Subsidiary`, `TimelineEntry`, `SiteSettings`, `ContactChannel`, `Office`, `SocialLink` | See 3.13.3. Admin-screen strings (Delete, Confirm Deletion, Edit Company, ...) are NOT seeded (the admin UI has its own static strings). |
| `logo.png` | `Media` -> `SiteSettings.logoLightMediaId` | Local file copy; no download. |
| Screens | reference only | Not imported. |

### 3.13.2 Typo / data cleanup step (`seed/data/typo-fixes.json`, applied to all text before insert; each applied fix is logged)

| Find (exact, case-sensitive) | Replace | Where seen |
|------------------------------|---------|-----------|
| `Bussiness` | `Business` | footer copyright ("Baraton Bussiness Group") |
| `FURKAWA` | `FURUKAWA` | home story ("FURKAWA Rock Drilling Machines") |
| `redictive Maintenance` | `Predictive Maintenance` | service content |
| `has resented in the delivery` | `has resulted in the delivery` | Montabert text (brand + product) |
| `SUMITOMO construction is was formed in 1888 in Japan, With the mentality` | `Sumitomo Construction was formed in 1888 in Japan, with the mentality` | Sumitomo brand short description |
| `Tata-Daewoo trucks spare parts` | `Tata-Daewoo truck spare parts` | footer blurb |
| `Walter Geratebou` | `Walter Gerätebau` | brand name |
| `Ockelbo, Sweden` / `sweden` | normalised through country table (SE) | product/brand country |
| `\r\n` | `\n` (then paragraph split) | all text |
| double spaces, trailing spaces, ` ,  ` (e.g. "FURUKAWA Co. ,  began") | collapsed / `Co., ` | Furukawa short description |
| `Furukawa` company text inconsistencies (`FURUKAWA`/`Furukawa`) | left as-is (brand styling), only the `FURKAWA` typo fixed | |
Additional normalisation: trim, collapse repeated blank lines, convert straight apostrophes in "CEO’s" to the typographic form only where the source already uses it (do not alter wording). Any text the cleanup changed is listed in `seed-report.json` under `typoFixes[]` with before/after for human review. The cleanup is data-driven (JSON file) so an editor can extend it.

### 3.13.3 Seed content by entity

- `SiteSettings`: `siteName "Barathon Trading"`, `legalName "Baraton Group Co."`, `tagline "Importer and distributor of rock drilling and construction machinery"`, `copyrightText "© {year} Baraton Group Co. All rights reserved."`, `footerBlurb "Founded in 2007, Baraton Group started with importing Tata-Daewoo truck spare parts and has grown into a diversified importer and distributor."`, `footerCredit {enabled:true, prefix:"Developed by", name:"Dagim Meseret", url:null}`, `headerCta {label:"Let's Talk", hrefType:"PATH", href:"/contact", icon:"phone"}`, `search.placeholder "Search Products..."`, brand colors sampled from the logo (primary navy `#2F3E7E`, accent maroon `#8B3A47`; admin editable), `seoDefaults.titleTemplate "%s | Barathon Trading"`.
- Menus: `HEADER` = Home (`/`), About Us (`/about`), Products (`DYNAMIC_PRODUCTS`, limit 12, viewAll "All products" -> `/products`), Service (`/services`, label kept "Service"), Contact Us (`/contact`). `FOOTER_QUICK` = About Us, Our Products (`/products`), Our Services (`/services`), Contact Us. `FOOTER_PRODUCTS` = `DYNAMIC_PRODUCTS` limit 5. `FOOTER_LEGAL` = empty (Privacy/Terms pages are created as DRAFT custom pages with placeholder text; the admin fills and publishes).
- `ContactChannel`: PHONE `+251 911 514558`, PHONE `+251 911 175644`, PHONE `+251 114 709133` (value stored normalised `+251911514558`, displayValue as shown), EMAIL `aboma.taye@gmail.com`.
- `Office`: "Head Office" — `Bole Road, Wollo Sefer`, `P.O.Box 62716`, `Addis Ababa`, `ET`, primary, visible. "Baraton Trade LLC" (Florida, USA) created hidden with no address (placeholder) linked to the LLC subsidiary.
- `SocialLink`: FACEBOOK, X, LINKEDIN, INSTAGRAM with `url = null`, `visible=false`, sortOrder FB, X, LinkedIn, Instagram (footer order seen on old site; contact page shows LinkedIn, X, Instagram).
- `Page home` (template HOME, system, PUBLISHED), blocks in order: (1) `HERO_CAROUSEL{source:'FEATURED_PRODUCTS',showThumbnails:true,showCounter:true,autoplayMs:6000,limit:8}`; (2) `BRANDS_MARQUEE{title:'Brands We Work With',subtitle:'Trusted by industry leaders worldwide',mode:'ALL',linkToBrand:true}`; (3) `IMAGE_TEXT{imageMediaId:<logo>,imagePosition:'LEFT',bodyHtml:<3 story paragraphs, typo-fixed>,buttons:[{Learn more -> /about, PRIMARY},{Our Products -> /products, SECONDARY}],background:'DARK'}`; (4) `VIDEOS_GRID{title:'Featured Videos',subtitle:'Discover our work through these immersive experiences',mode:'FEATURED',limit:6}`; (5) `SERVICES_GRID{title:'Our Services',mode:'ALL',ctaLabel:'Read More'->/services}`. Optional blocks `STATS`, `TESTIMONIALS`, `LATEST_POSTS`, `CTA_BANNER` are NOT seeded (admin adds).
- Story paragraphs (typo-fixed): P1 "BARATON Group began operating in 2007, as importer and distributor of Tata-Daewoo truck spare parts and heavy construction machinery rental in Ethiopia. Over the next 17 years, the company grew significantly, diversifying its operations to include the import and sale of a variety of products." P2 "These included FURUKAWA Rock Drilling Machines from Japan, AIRMAN Air Compressors from Japan, HIFI Filtration Solutions from Switzerland, and ROBIT Rock Drilling Accessories from Finland. The company also ventured into construction sales and rental of real estate properties in the US, Kenya, and Ethiopia." P3 "In 2019, BARATON Group expanded further by setting up a USA-based subsidiary, BARATON Trade LLC, and a woodworking factory. This marked the transition to the BARATON Group." P4 "Since its formation, the BARATON Group has strengthened its customer services and broadened its resource access in key hub countries. Today, the group provides a wide array of services, including rock drilling, compressed air systems, filtration, construction machinery attachments, and real estate." ("17 years" is stored as authored text; the admin should review it because it ages — logged in seed report as `staleCopyWarnings`.)
- `Page about` (template ABOUT, system, PUBLISHED), blocks: (1) `LEADER_MESSAGE{leaderMessageId:null}` anchor `ceo-message`, navLabel "CEO Message", showInTabNav; (2) `TIMELINE{mode:'ALL'}` anchor `history`, navLabel "Our History", showInTabNav=false initially; (3) `MISSION_VISION{visionHtml:<vision paragraph>}` anchor `philosophy`, navLabel "Philosophy", showInTabNav; (4) `SUBSIDIARIES{layout:'TABS'}` anchors per subsidiary: `baraton-trade-llc` "Baraton Trade LLC", `baraton-trade-plc` "Baraton Trade PLC" (these two appear in the tab nav as the old site's 4 tabs: CEO Message, Philosophy, Baraton Trade LLC, Baraton Trade PLC). Implementation note: tab entries for subsidiaries are generated from the `SUBSIDIARIES` block's resolved list (`navLabel` = subsidiary name) — the API adds `tabNav[]` to the page response (3.14).
- `LeaderMessage` (primary): heading "CEO's Message", name/photo empty, `messageHtml` = the two paragraphs from ui-strings ("Since our company’s founding in 2007, ... end users.").
- `CoreValue` group MISSION (4, PUBLISHED, in order): "Committed to excellence by leveraging our competitive advantages in every field we operate." / "Upholding the highest standards of business ethics and organizational values." / "Delivering customer satisfaction through exceptional products and services." / "Cultivating a culture of trust, openness, and mutual respect, making our workplace both stimulating and rewarding."
- Vision text (stored in `MISSION_VISION.data.visionHtml`): "To be a regional leader in our industry, driven by sustainable growth, knowledge, excellence, and best practices. As we face the challenges ahead, we will stay agile, adapting to the evolving world while remaining a trusted partner for the companies that rely on us. Together, we shape the future!"
- `CoreValue` group VALUE: four DRAFT items derived from the mission sentences (title only: "Excellence", "Integrity and business ethics", "Customer satisfaction", "Trust, openness and respect"); DRAFT so nothing invented goes live; flagged in the report.
- `TimelineEntry` (PUBLISHED): "2007" — Founded: Tata-Daewoo truck spare parts import and distribution, heavy construction machinery rental in Ethiopia; "2007 - 2024" — Diversification: FURUKAWA rock drilling machines (Japan), AIRMAN air compressors (Japan), HIFI filtration (Switzerland), ROBIT rock drilling accessories (Finland); real estate construction, sales and rental in the US, Kenya, Ethiopia; "2019" — USA subsidiary BARATON Trade LLC and a woodworking factory; transition to BARATON Group; "Today" — Rock drilling, compressed air systems, filtration, construction machinery attachments and real estate services.
- `Subsidiary` Baraton Trade LLC: country `US`, regionNote "Florida, USA", introHtml = "A subsidiary of Baraton Group, Baraton Trade LLC operates globally, offering innovative and reliable product solutions. Licensed in Florida, USA, the company prioritizes exceptional customer service and strong relationships." bodyHtml = "With a focus on quality and integrity, Baraton Trade LLC ensures clients receive top-notch support while driving industry advancements through continuous innovation."; lists: "Focus areas" (CHECKS) = [Technological Solutions, Real Estate Development & Portfolio Management, Stock & Share Portfolio Management, Global Product Distribution]; "Our brands are recognized for their exceptional performance, cost efficiency, quality, and safety standards. Baraton Group provides comprehensive solutions for:" (BULLETS) = [Construction machinery, Rock drilling tools, Hydraulic attachments, Equipment servicing & support]; `SubsidiaryBrand` EXCLUSIVE_RIGHTS -> Furukawa, AIRMAN (text "Baraton Trade LLC holds exclusive sales and marketing rights for: Furukawa Rock Drill Co. Ltd – Japan, Ethiopia; Airman Industries Ltd – Japan, Ethiopia" is kept as a third list). Also a list "Real Estate Portfolio" / "Stock & Share Management" (CHIPS).
- `Subsidiary` Baraton Trade PLC: country `ET`; introHtml = "A proud subsidiary of Baraton Group, Baraton Trade PLC is the official agent of Furukawa Rock Drills Co., Ltd and Airman Corporation Ltd in Ethiopia."; bodyHtml = the 4 paragraphs ("With the expertise of our consultants and certified engineers..." / "Our authentic, high-quality parts..." / "We recognize that fast access..." / "Baraton Trade PLC delivers cutting-edge technology..."); lists: "We provide everything you need to keep your machines and attachments in top condition. Whether you're looking for:" (CHECKS) = [Genuine replacement parts, Technical support, Self-repair resources]; `SubsidiaryBrand` OFFICIAL_AGENT -> Furukawa, AIRMAN.
- `UiString` seeds (group in brackets): [form] `contact.title "Send us a message"`, `contact.info.title "Contact Information"`, `contact.info.intro "Fill out the form or contact us through these channels"`, `contact.field.name "Your Name"`, `.name.placeholder "John Doe"`, `contact.field.email "Email Address"`, `.email.placeholder "john@example.com"`, `contact.field.phone "Phone Number"`, `.phone.placeholder "+251 911 123456"`, `contact.field.message "Your Message"`, `.message.placeholder "How can we help you?"`, `contact.submit "Send Message"`, `contact.followUs "Follow Us"`, `contact.phone "Phone"`, `contact.email "Email"`, `contact.address "Address"`; [common] `nav.search.placeholder`, `common.loading "Loading..."`, `common.learnMore "Learn more"`, `common.readMore "Read More"`, `common.viewAll "View all"`, `footer.quickLinks "Quick Links"`, `footer.ourProducts "Our Products"`, `footer.contactUs "Contact Us"`, `products.empty "No products found"`, `notFound.title`, `notFound.text`, `notFound.cta`, `contact.success`, `contact.error`, `contact.rateLimited`, `product.inquire "Request a quote"`, `product.downloads "Downloads"`, `product.specs "Specifications"`, `product.related "Related products"`.
- `FaqGroup`/`Testimonial`/`Post`: not seeded (no source); `/public/faqs` etc. return empty arrays.
- Legacy redirects (`legacy-redirects.json` + generated from `legacyId`): `/product/{legacyId}` -> `/products/{slug}` (301, EXACT, per product), `/company/{legacyId}` -> `/brands/{slug}` (per brand), `/service` -> `/services`, `/product` -> `/products`, `/home` -> `/`, `/about-us` -> `/about`, `/contact-us` -> `/contact`, `/admin/login` is NOT redirected.
- Admin user: not created by `seed` unless env `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are set and no user exists (then `mustChangePassword=true`); otherwise use `cli admin:create`.
- SEO seed: `SeoMeta` rows with `metaTitle`/`metaDescription` (<=160 chars, generated from `shortDescription`) for each product/brand/service/page, `noindex=false`.

### 3.13.4 Country normalisation table

| Source text | countryCode | countryName | city |
|-------------|-------------|-------------|------|
| `Japan` | JP | Japan | - |
| `Tokyo,Japan` | JP | Japan | Tokyo |
| `Saitama, Japan` | JP | Japan | Saitama |
| `France` | FR | France | - |
| `Germany` | DE | Germany | - |
| `Italy` | IT | Italy | - |
| `sweden` | SE | Sweden | - |
| `Ockelbo, Sweden` | SE | Sweden | Ockelbo |
Unmatched values: `countryCode = NULL`, `countryName` = cleaned original, flagged in the report.

### 3.13.5 Asset import (`seed:assets`)

1. Collect every image URL from `product.json`, `company.json`, `service.json` (Cloudinary host `res.cloudinary.com` only — any other host is refused, SSRF guard).
2. Download with `fetch` (timeout 15 s, max 12 MB, 3 retries with backoff, `redirect: 'error'`), process through the same `MediaService.ingest()` pipeline as uploads (so variants/blurhash exist), `uploadedBy = null`.
3. On failure (404/timeout/invalid image): the entity keeps `mediaId = null`, the failure is recorded in `seed-report.json.assetFailures[]` with the entity and URL; the admin dashboard shows a "Missing images" warning card (computed: published entities without hero image).
4. The manifest `assets-manifest.json` (url -> mediaId) makes reruns idempotent.
5. Alt text defaults to the entity title ("{title} logo" for brand logos).

## 3.14 Read models returned by the public API (shape summary; full DTO list in section 10)

- `Page` public response always contains `blocks[]` with `resolved` data and `tabNav[]` (`{label, anchorId}`) built from blocks where `showInTabNav` plus subsidiary tabs.
- All public list items are "card" projections (no heavy HTML); detail endpoints return full `contentHtml`.
- Every response includes `seo` (resolved with defaults applied: `title` already templated, `description`, `canonical` absolute, `og`, `robots`, `jsonLd[]`).

---

# 4. Authentication and security (custom Passport.js module)

Module: `apps/api/src/auth`. No third-party identity provider. Single role `ADMIN`. No registration endpoint exists anywhere.

## 4.1 Components

| Component | Passport strategy / lib | Responsibility |
|-----------|-------------------------|----------------|
| `LocalStrategy` | `passport-local` (`usernameField: 'email'`) | Validate email+password (argon2id verify, lockout, active check). Returns `User` or throws `UnauthorizedException('INVALID_CREDENTIALS')`. |
| `JwtStrategy` (name `jwt`) | `passport-jwt` with custom extractor reading cookie `bt_at` (fallback: `Authorization: Bearer` only when `ALLOW_BEARER=true`, for API tooling/tests; default false) | Verify access JWT (HS256, `JWT_ACCESS_SECRET`, `issuer`, `audience`), then check `tokenVersion` and session not revoked (10 s in-memory cache), user `isActive`. Attaches `req.user = {id, email, name, role, sessionId}`. |
| `RefreshStrategy` (name `refresh-token`) | `passport-custom` | Read cookie `bt_rt` (`<sessionId>.<secret>`), look up by sha256(secret), enforce rotation rules (4.3). Attaches `req.refresh = {session, token}`. |
| `TotpChallengeStrategy` | `passport-custom` | Verifies the `challengeToken` (signed JWT, purpose `totp`, 5 min) for the 2FA second step. |
| Guards | `LocalAuthGuard`, `JwtAuthGuard` (global; honours `@Public()`), `RefreshAuthGuard`, `RolesGuard` (`@Roles(Role.ADMIN)`; default for all admin controllers), `CsrfGuard`, `OriginGuard` | |
| Decorators | `@Public()`, `@CurrentUser()`, `@CurrentSession()`, `@Roles()`, `@Audit({action, entityType})` | |
| Services | `AuthService` (login/logout/refresh orchestration), `TokenService` (sign/verify JWT, generate/hash opaque tokens), `SessionService`, `PasswordService` (argon2, policy, HIBP), `PasswordResetService`, `TwoFactorService`, `LockoutService`, `CsrfService`, `CryptoService` (AES-256-GCM for TOTP secret) | |

## 4.2 Token design

| Token | Format | Lifetime | Storage (client) | Storage (server) |
|-------|--------|----------|------------------|------------------|
| Access | JWT HS256. Claims: `sub` (userId), `sid` (sessionId), `role`, `tv` (user.tokenVersion), `iat`, `exp`, `iss='barathon-api'`, `aud='barathon-admin'`, `jti` | 15 min (`ACCESS_TTL=900`) | cookie `bt_at`: `HttpOnly; Secure; SameSite=Lax; Path=/api` | none (stateless) + session check |
| Refresh | Opaque: `<sessionId>.<43-char base64url secret from 32 random bytes>` | idle 14 d, absolute 30 d (`REFRESH_IDLE_DAYS`, `SESSION_ABSOLUTE_DAYS`) | cookie `bt_rt`: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` | `RefreshToken.tokenHash = sha256(secret)` (never the secret) |
| CSRF | 32 random bytes base64url | tied to session refresh; rotated on login/refresh | cookie `bt_csrf`: `Secure; SameSite=Lax; Path=/` (NOT HttpOnly; frontend reads and echoes) | not stored (double-submit) |
| TOTP challenge | JWT purpose `totp`, `sub`, `exp 5m`, single use by `jti` kept in memory set | 5 min | JSON response body only | - |
| Password reset | 32 random bytes base64url, emailed | 30 min, single use | URL query only | `PasswordResetToken.tokenHash = sha256(token)` |

Cookie naming: when `COOKIE_SECURE=true` (production) the names get prefixes: `__Host-bt_at` (Path `/`; required by `__Host-`; so the access cookie path becomes `/` in production), `__Secure-bt_rt` (Path `/api/v1/auth`), `__Secure-bt_csrf`. Implementation: a `CookieNames` helper builds names from config so frontend docs/tests use the helper constants exposed in `packages/contracts`. In development (http://localhost) no prefixes, `Secure` off. `Domain` attribute is never set (host-only cookies).

Why JWT access + DB-backed refresh: low-latency verification for the admin UI while giving server-side revocation (sessions) and reuse detection.

## 4.3 Flows (sequence descriptions)

### 4.3.1 Login (no 2FA)
1. `POST /auth/login {email, password}`. `OriginGuard` verifies `Origin`/`Referer` host is in `ALLOWED_ORIGINS`. Throttle: 10 req/min/IP and 5 req/15 min per `(ip,email)`.
2. `LocalStrategy`: lowercase+trim email; load user; if missing, run a dummy argon2 verify against a constant hash (constant-time response), then fail with generic `INVALID_CREDENTIALS` (401).
3. If `lockedUntil > now` -> 423 `ACCOUNT_LOCKED` (message generic: "Too many attempts. Try again later.", includes `retryAfterSeconds`). Do not reveal whether the password was right.
4. Verify argon2id (with pepper). On failure: increment `failedLoginCount`; on 5th consecutive failure set `lockedUntil = now + 15min * 2^(lockCount)` capped 24 h (`lockCount` derived from consecutive lockouts stored as `failedLoginCount` ranges: 5->15 min, 10->30 min, 15->60 min, ... cap 24 h); write `AuditLog LOGIN_FAILED` (and `ACCOUNT_LOCKED`). On success reset counters.
5. If `!isActive` -> 401 generic. If password hash needs rehash (argon2 params changed) -> rehash silently.
6. If `totpEnabledAt != null` -> respond `200 {status:'TOTP_REQUIRED', challengeToken}` (no cookies). Else continue.
7. Create `AuthSession` (+ first `RefreshToken`), sign access JWT, set cookies `bt_at`, `bt_rt`, `bt_csrf`; respond `200 {status:'OK', user, mustChangePassword, csrfToken}`. Write `AuditLog LOGIN` (ip, user agent), update `lastLoginAt/Ip`. If `mustChangePassword` the frontend forces `/admin/change-password`; the API blocks all admin routes except `/auth/*` with 403 `PASSWORD_CHANGE_REQUIRED` until changed.

### 4.3.2 Login with 2FA
`POST /auth/login/totp {challengeToken, code}` (6-digit TOTP, window ±1 step, replay protected by storing last used step per user in memory + DB column `totpLastStep` — add `totpLastStep int NULL` to `User`) or `{challengeToken, recoveryCode}` (marks `RecoveryCode.usedAt`). Failure counts toward the same lockout counter. Success continues at step 7 above.

### 4.3.3 Refresh (rotation + reuse detection)
1. `POST /auth/refresh` (no body; cookie `bt_rt`; CSRF header required; `SameSite=Strict` cookie).
2. `RefreshStrategy` splits cookie -> `sessionId`, `secret`; loads `RefreshToken` by `tokenHash`. Reject (401 `REFRESH_INVALID`, clear cookies) if not found, `session.revokedAt`, session expired (idle/absolute), user inactive, or token `expiresAt < now`.
3. If `token.usedAt != null` (already rotated): 
   - if `now - usedAt <= 10 s` (legit concurrent tab race) -> 401 `REFRESH_RACE` WITHOUT revoking (frontend retries `/auth/me` after a short delay; frontend implements single-flight refresh to avoid this);
   - else **reuse detected**: revoke the whole session (`revokedReason='REUSE_DETECTED'`), bump nothing else, write `AuditLog REFRESH_REUSE_DETECTED` with ip/UA, clear cookies, respond 401 `REFRESH_REUSE`.
4. Else, in one DB transaction: mark current token `usedAt=now, replacedById=new`; insert new token (`parentId = current`); update session `lastUsedAt`, `idleExpiresAt = now+14d` (not beyond absolute); sign new access JWT; set cookies (new `bt_at`, `bt_rt`, `bt_csrf`). Respond `200 {user, csrfToken}`.

### 4.3.4 Logout / logout everywhere
- `POST /auth/logout` -> revoke current session (`LOGOUT`), clear cookies, 204.
- `POST /auth/logout-all` -> revoke all sessions of the user (`LOGOUT_ALL`), bump `tokenVersion`, clear cookies, 204.

### 4.3.5 Session list / revoke
- `GET /auth/sessions` -> list active sessions `{id, deviceLabel, ip, createdAt, lastUsedAt, current:boolean}`.
- `DELETE /auth/sessions/:id` -> revoke one (own sessions only; revoking current = logout). 204. Unknown/other user's id => 404.

### 4.3.6 Forgot / reset password
1. `POST /auth/forgot-password {email}` -> ALWAYS `202 {message:'If the email exists, a reset link has been sent.'}` with constant-ish timing (work done in a queued job, response returned immediately). Throttle 3/hour per email, 10/hour per IP. Cloudflare Turnstile optional (`FORGOT_CAPTCHA=true`).
2. Job: if user exists and `isActive`: invalidate previous unused tokens, create token (32 random bytes), store sha256, expiry 30 min, email template `password-reset` containing `${ADMIN_URL}/admin/reset-password?token=<token>` (token in query; page must set `Referrer-Policy: no-referrer`). Audit `PASSWORD_RESET_REQUEST`.
3. `POST /auth/reset-password {token, newPassword}` -> validates token (exists, unused, unexpired; constant-time compare of hashes), validates password policy, sets new hash, `passwordChangedAt=now`, `mustChangePassword=false`, `tokenVersion++`, marks token used, revokes ALL sessions (`PASSWORD_RESET`), resets lockout, sends "password changed" email, audit `PASSWORD_RESET`. Responds 204. Does NOT log the user in (they must log in). Invalid/expired -> 400 `RESET_TOKEN_INVALID`.
4. `POST /auth/reset-password/validate {token}` -> `200 {valid:boolean}` so the UI can show an expired message early (throttled 20/hour/IP; no user info).

### 4.3.7 Change password
`POST /auth/change-password {currentPassword, newPassword}` (auth + CSRF): verify current (counts toward lockout), policy check, new != current and not among last 5 hashes (`PasswordHistory`: add table `password_history(userId, hash, createdAt)` keep 5), set hash, `tokenVersion++`, revoke all OTHER sessions, keep current session (issue fresh tokens), email "password changed", audit `PASSWORD_CHANGE`.

### 4.3.8 First-admin bootstrap
- CLI: `pnpm --filter api cli admin:create --email you@x.com --name "Name"` (password prompted twice with hidden input, policy enforced; or `--password-stdin`). Fails if email exists.
- Optional env bootstrap (used by `seed` only when zero users exist): `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` (>= 12 chars) -> user created with `mustChangePassword=true`. The documentation instructs removing both from `.env` after first start.
- Other CLI commands: `admin:reset-password --email`, `admin:unlock --email`, `admin:2fa-disable --email`, `admin:list`. All write AuditLog entries with actor `CLI`.
- There is no HTTP route to create users in v1. (Phase-2 optional: `POST /admin/users` behind an existing admin + email invite.)

### 4.3.9 TOTP 2FA (optional per user)
- `POST /auth/2fa/setup` (auth, CSRF; requires re-entering password in body `{password}`) -> generates secret, stores encrypted in `totpSecretEnc` but `totpEnabledAt` stays null; returns `{otpauthUri, secretBase32}` (shown once).
- `POST /auth/2fa/enable {code}` -> verifies code, sets `totpEnabledAt`, generates 10 recovery codes (format `XXXXX-XXXXX`, 50 bits), stores sha256 hashes, returns the plaintext codes once; revokes other sessions; audit `TWO_FA_ENABLE`.
- `POST /auth/2fa/disable {password, code|recoveryCode}` -> clears secret and codes; audit `TWO_FA_DISABLE`.
- `POST /auth/2fa/recovery-codes/regenerate {password, code}` -> new set.
- Env `REQUIRE_2FA=true` makes the API return `403 TWO_FA_SETUP_REQUIRED` on admin routes until enabled (default false).

## 4.4 Password policy and hashing

| Item | Rule |
|------|------|
| Algorithm | argon2id, params `memoryCost 65536 KiB (64 MiB)`, `timeCost 3`, `parallelism 1`, 32-byte hash, 16-byte salt; tune so one hash takes 150-300 ms on the VPS (env overrides `ARGON2_MEMORY_KIB`, `ARGON2_TIME_COST`) |
| Pepper | `PASSWORD_PEPPER` (>= 32 chars) applied as HMAC-SHA256(pepper, password) before argon2 (rotatable by versioned prefix in hash metadata: store `pepperVersion` smallint on User; default 1) |
| Length | 12..128 chars |
| Strength | zxcvbn-ts score >= 3 using user inputs (email, name, "baraton", "barathon") |
| Disallowed | contains email local part; equals last 5 passwords; fails HIBP range check (`HIBP_CHECK=true` default; fail-open on network error, log warning) |
| Whitespace | no trimming; allow all Unicode |
| Rehash | on login if `argon2.needsRehash` |

## 4.5 Brute-force protection and rate limits (named throttlers, in-memory store v1)

| Route | Limit | Key |
|-------|-------|-----|
| `POST /auth/login` | 10 / min and 5 / 15 min | IP, and IP+email |
| `POST /auth/login/totp` | 10 / 5 min | IP+challenge `jti` |
| `POST /auth/refresh` | 30 / min | IP |
| `POST /auth/forgot-password` | 3 / hour (email), 10 / hour (IP) | email, IP |
| `POST /auth/reset-password*` | 10 / hour | IP |
| `POST /public/contact` | 5 / hour and 20 / day | IP; plus 3 / hour per email |
| `GET /public/products/search`, `/public/search` | 60 / min | IP |
| Other public GET | 300 / min | IP (the Next.js server uses an internal key to bypass: header `x-internal-key` equals `INTERNAL_API_KEY`, only accepted from private network addresses / when `TRUST_PROXY` hop is the compose network) |
| Admin API (authenticated) | 600 / min | userId |
| Media upload | 60 / hour | userId |
Account lockout is separate (4.3.1 step 4). All 429 responses include `Retry-After` and body code `RATE_LIMITED`. `trust proxy` is set to the number of proxy hops so IPs are real.

## 4.6 CSRF approach

Cookie auth => CSRF defences are mandatory:
1. `SameSite=Lax` on access cookie, `SameSite=Strict` on refresh cookie.
2. Double-submit token: all unsafe methods (`POST, PUT, PATCH, DELETE`) on `/admin/*` and `/auth/*` (except `login`, `login/totp`, `forgot-password`, `reset-password`, `reset-password/validate` which have no session yet) require header `X-CSRF-Token` equal to cookie `bt_csrf`; compared in constant time; mismatch -> 403 `CSRF_INVALID`.
3. `OriginGuard`: for the same unsafe methods, `Origin` (or `Referer` fallback) MUST match `ALLOWED_ORIGINS`; if both absent -> 403 `ORIGIN_REQUIRED` (browsers always send Origin on cross-origin and on same-origin POST).
4. JSON only: admin/auth routes accept only `Content-Type: application/json` or `multipart/form-data` (media upload); other types -> 415.
5. Public endpoints are unauthenticated and not cookie-dependent, so CSRF is N/A; CORS restricts browsers anyway.
6. The Next.js server-side fetches (SSR) call the API over the internal Docker network and forward the admin cookies only for `/admin` pages; never for public pages.

## 4.7 Guards, decorators, route protection map

- Global `JwtAuthGuard` denies everything except routes marked `@Public()`. Public: all `/public/*` GET + `POST /public/contact`, `/auth/login`, `/auth/login/totp`, `/auth/refresh` (uses `RefreshAuthGuard`), `/auth/forgot-password`, `/auth/reset-password*`, `/health/*`, `/public/revalidate-ping` (none). Everything under `/admin/*` and remaining `/auth/*` requires a valid access token.
- `GET /auth/me` returns `{id,email,name,role,mustChangePassword,twoFactorEnabled,csrfToken}`; used by Next.js admin layout (server-side) to gate pages.
- Next.js middleware for `/admin/**` only checks cookie presence (redirect to `/admin/login`); real authorisation always happens at the API.

## 4.8 Audit logging of auth events

Events: `LOGIN`, `LOGIN_FAILED` (with attempted email hashed? store the attempted email in `summary`, not the password), `LOGOUT`, `TOKEN_REFRESH` (sampled: NOT logged each time; only `REFRESH_REUSE_DETECTED` is), `PASSWORD_CHANGE`, `PASSWORD_RESET_REQUEST`, `PASSWORD_RESET`, `SESSION_REVOKE`, `TWO_FA_ENABLE`, `TWO_FA_DISABLE`, `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED` (CLI). Every record includes `ip`, `userAgent`, `requestId`. A new-login-from-new-device email alert is sent when `userAgent+ip /24` was not seen in the last 30 days of sessions (`NEW_LOGIN_ALERT=true`).

## 4.9 Security hardening checklist (cross-cutting)

| Area | Requirement |
|------|-------------|
| HTTP headers | `helmet()` with CSP for the API (default-src 'none'; frame-ancestors 'none') since API returns JSON; `Referrer-Policy: no-referrer`; HSTS in prod via proxy; `X-Content-Type-Options: nosniff`; `Cross-Origin-Resource-Policy: same-site`; `Permissions-Policy` minimal. The Next.js app owns the page CSP (frontend plan) and must allow `https://www.youtube-nocookie.com` frames and `https://i.ytimg.com` images. |
| CORS | Allow only `ALLOWED_ORIGINS` (exact match), `credentials: true`, methods `GET,POST,PATCH,PUT,DELETE`, headers `Content-Type, X-CSRF-Token, X-Request-Id`; expose `X-Request-Id, ETag`; preflight cache 600 s. Wildcard forbidden. Same-origin in prod so rarely used. |
| Validation | Global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true, transform:true, transformOptions:{enableImplicitConversion:false}})`; UUID params validated; pagination bounds; max body 1 MB for JSON (`bodyParser` limit) and 32 MB for multipart route only. |
| SQL injection | Prisma parameterisation only; raw SQL via `Prisma.sql` tagged templates only (search service); lint rule bans `$queryRawUnsafe`/`$executeRawUnsafe`. |
| XSS | Rich text sanitized on write with `sanitize-html` allow-list: tags `p, br, strong, em, u, s, blockquote, ul, ol, li, h2, h3, h4, a, img, figure, figcaption, table, thead, tbody, tr, th, td, hr, code, pre, span` ; attributes `a[href,title,target,rel]`, `img[src,alt,width,height,loading]`, `th/td[colspan,rowspan]`, `*[class]` limited to a prefix allow-list `tw-`/`prose-` (or none); URL schemes `http, https, mailto, tel`; `img src` must be same-origin media path or `https` to allow-listed host; `target=_blank` forces `rel="noopener noreferrer"`; no `style`, no event handlers, no `iframe`/`script`/`form`. Plain-text fields are stored raw and escaped by the frontend (React escapes by default); API strips control characters. JSON-LD override output is served as JSON (never HTML-concatenated). SVG uploads sanitized (4.9 / 5.4). |
| SSRF | The API never fetches user-supplied URLs, except: seed asset downloader (host allow-list `res.cloudinary.com`, https only, no redirects), captcha verification (fixed Turnstile/hCaptcha endpoints), revalidation webhook (fixed `WEB_REVALIDATE_URL` from env), optional YouTube oEmbed (fixed host, ID constructed server-side after regex check). Map embed URLs and video URLs are stored as data and only rendered by the browser after host allow-list validation at write time. |
| Uploads | MIME sniff via magic bytes, extension allow-list, size caps, image decode via sharp with `limitInputPixels: 100_000_000`, `failOn: 'error'`, random server-generated keys (client filename never used in object key), SVG sanitization, PDFs scanned for embedded JS markers (`/JavaScript`, `/JS`, `/Launch`, `/OpenAction` -> reject) , polyglot protection through re-encoding raster images (original kept re-encoded with EXIF stripped). |
| Secrets | Only via env/Docker secrets (`*_FILE` variants supported: if `JWT_ACCESS_SECRET_FILE` is set, read file). `.env` never committed (`.gitignore`), `.env.example` has placeholders. Boot fails if secrets are default/placeholder or shorter than 32 chars in production. Pino redaction: `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `*.password`, `*.currentPassword`, `*.newPassword`, `*.token`, `*.code`, `*.recoveryCode`. |
| Error handling | No stack traces in responses outside `NODE_ENV=development`; generic 500 body with `requestId`. |
| Enumeration | Login/forgot responses identical for unknown vs known emails; resource IDs are UUID v7. |
| Dependency hygiene | `pnpm audit` in CI; Renovate/Dependabot; lockfile frozen installs; Docker image runs as non-root user, read-only root FS where feasible. |
| Logging of PII | IPs/UA only in audit/messages; message bodies never logged. |
| Clickjacking | `frame-ancestors 'none'` on admin pages (frontend) and API. |
| Open redirects | Redirect targets stored in `Redirect` are validated: path-relative (`/...`) or absolute `https://` URL on an allow-listed host (`REDIRECT_ALLOWED_HOSTS`, default own domain); `//host` and `javascript:` refused. |
| Time | Server clock UTC, NTP on VPS. |
| Data retention | `purge-audit` job (365 d), message IP truncation after 90 d, expired tokens purge nightly. |

---

# 5. MinIO file handling and image pipeline

## 5.1 Buckets

| Bucket | Access | Content | Notes |
|--------|--------|---------|-------|
| `public-media` | Anonymous read-only on prefix `media/*` via bucket policy (no list); write only via API credentials | Images, SVG, favicon, public PDFs (brochures with `visibility=PUBLIC`) | Reverse proxy exposes `/media/<key-after-media/>` -> `public-media/media/...`; MinIO endpoint itself is NOT exposed publicly |
| `private-docs` | No anonymous access | Private PDFs (`visibility=PRIVATE`), generated exports/imports staging, backups bundle staging | Access via short-lived presigned GET (5 min) generated by API, delivered through `302` from `GET /public/products/:slug/documents/:docId/download` (for private docs the endpoint additionally requires nothing in v1 because a "private" doc here means "not directly guessable/indexed"; REAL admin-only docs are served via `GET /admin/media/:id/download`) |

Bucket creation/policies are applied idempotently at API boot by `MinioService.ensureBuckets()` and by the `minio-init` compose job (`mc`). Versioning off (backups handle recovery); server-side encryption optional (SSE-S3 if KMS configured; not required v1). Lifecycle rule on `private-docs/tmp/` expiring objects after 1 day.

## 5.2 Upload approach decision

Decision: **proxied upload through the API** (multipart/form-data to `POST /admin/media`) for v1, not presigned PUT.

Reasons: (1) every image must be decoded, validated, re-encoded and turned into variants by sharp on the server anyway, so bytes must reach the API; (2) uploads are infrequent and small (admin only); (3) it keeps MinIO private and the browser free of MinIO credentials/CORS; (4) simpler security (single validation point). Limits: reverse proxy `client_max_body_size 30m` (Caddy `request_body max_size 30MB`), multer memory storage (files <= 25 MB, so memory is fine) with `limits.files = 10` per request. Presigned PUT is documented as a Phase-8 optimisation for large documents only (`POST /admin/media/presign` is NOT part of v1).

## 5.3 Object key naming

```
public-media/media/{yyyy}/{mm}/{mediaId}/v1/original.{ext}
public-media/media/{yyyy}/{mm}/{mediaId}/v1/w{width}.{webp|avif}      e.g. w640.webp, w1280.avif
public-media/media/{yyyy}/{mm}/{mediaId}/v1/thumb.webp                  (400 px wide, used by admin library)
public-media/media/{yyyy}/{mm}/{mediaId}/v1/{slugified-original-name}.pdf   (documents: readable name for download; id folder guarantees uniqueness)
private-docs/docs/{yyyy}/{mm}/{mediaId}/v1/{slugified-original-name}.pdf
private-docs/exports/{iso-timestamp}-{userId}.json
```
`mediaId` is the UUID v7 of the `Media` row (so keys are unguessable; replacing a file keeps `mediaId` but writes to a new versioned folder `{mediaId}/v{n}/...` and updates `objectKey`/variants, because URLs must change for cache busting; old objects are removed after success). Final key pattern: `media/{yyyy}/{mm}/{mediaId}/v{n}/...`, `n` starts at 1.

## 5.4 Allowed types and sizes

| Kind | MIME (sniffed) | Extensions | Max size | Notes |
|------|----------------|------------|----------|-------|
| IMAGE | `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif` (first frame only converted to webp, original kept) | jpg, jpeg, png, webp, avif, gif | 12 MB, max 8000x8000 px, <= 100 MP | Variants generated |
| SVG | `image/svg+xml` | svg | 1 MB | `svgo` + DOMPurify SVG profile (no `<script>`, no `on*`, no `<foreignObject>`, no external `href`/`xlink:href`, no `<use>` external); stored sanitized; no raster variants (frontend uses it directly, `width/height` parsed from viewBox) |
| ICON | `image/x-icon`, `image/vnd.microsoft.icon`, `image/png` | ico, png | 256 KB | Only accepted when `kind=ICON` intent (favicon fields) |
| DOCUMENT | `application/pdf` | pdf | 25 MB | Magic bytes `%PDF-`; JS/launch scan; `Content-Disposition: attachment` for download endpoint |
Everything else -> `415 UNSUPPORTED_MEDIA_TYPE`. Client-declared MIME mismatching sniffed type -> sniffed wins; extension mismatching sniffed type -> 415.

## 5.5 Image pipeline (sharp)

1. Validate size and sniff type. Decode with `sharp(buffer, {failOn:'error', limitInputPixels:100_000_000})`; `.rotate()` applies EXIF orientation; metadata (EXIF/GPS) stripped from all outputs.
2. Store the (re-encoded, EXIF-stripped) original as `original.{ext}` (JPEG quality 90 mozjpeg for JPEG; PNG compressionLevel 9; webp/avif kept).
3. Compute metadata: `width`, `height`, `blurhash` (4x3 components from 32x32 downscale), `dominantColor` (sharp `stats().dominant`), `lqip` (20px wide webp base64, quality 30, only if <= 1.5 KB).
4. Variants (never upscale; skip widths >= original width except the largest that fits): widths `[320, 640, 960, 1280, 1920]` as `webp` (quality 80, effort 4) and `avif` (quality 55, effort 4); plus `thumb.webp` 400 px (admin). PNG with alpha keeps alpha in webp/avif.
5. Variants for the first two widths (`w320`, `w640` webp) and `thumb` are generated synchronously so the response is immediately usable; remaining variants run in the `image-variants` pg-boss job (`processingStatus` PENDING -> READY; retry 3x; FAILED recorded). Responses expose `variants[]` only for READY ones, and always `url` (original) so pages never break.
6. Idempotent: job generates only missing `(label, format)` pairs.
7. Admin gets `focalX/focalY` to support CSS `object-position`; no server-side cropping in v1.
8. Alt text: `alt` is nullable at upload; the admin UI warns and the entity save endpoints return `warnings: [{code:'MEDIA_ALT_MISSING', mediaId}]` when a referenced media has no alt (non-blocking). Decorative images may set `alt = ""` explicitly (distinguish `null` = not set).

## 5.6 Public URL strategy and caching

- Public URL = `${PUBLIC_MEDIA_BASE_URL}/{objectKeyWithoutLeadingMedia}` e.g. `https://baratongroup.example/media/2026/11/<id>/v1/w640.webp` (the proxy maps `/media/*` to `public-media/media/*`). The API returns absolute URLs built from `PUBLIC_MEDIA_BASE_URL`, so the domain can change (or a CDN be introduced) without data changes; the DB stores only keys.
- Response headers set by the proxy for `/media/*`: `Cache-Control: public, max-age=31536000, immutable` (keys are versioned), `Access-Control-Allow-Origin` not needed for `<img>`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` for images, `attachment` for PDFs? (PDF inline preview allowed; `inline`), `Vary: Accept` NOT used (format chosen by `<picture>` sources, not content negotiation).
- CDN-ready: stateless, immutable URLs, no query strings, `ETag` preserved from MinIO.
- `MediaDto.srcset` helper strings (`srcsetWebp`, `srcsetAvif`) are returned so Next.js can render `<picture>`; frontend may alternatively use `next/image` with `unoptimized` + these variants.

## 5.7 Orphan cleanup and consistency

| Job | Schedule | Action |
|-----|----------|--------|
| `media-orphans` | daily 03:30 | (a) Media rows with zero `MediaRef` and `createdAt < now-7d` and not in library folders flagged `keep`: reported (NOT deleted automatically) in `GET /admin/media?unused=true` and dashboard card; (b) MinIO objects under `public-media/media/` with no matching `Media`/`MediaVariant.objectKey` older than 24 h are deleted (listing by prefix per day); (c) `Media` rows soft-deleted > 30 d are purged with objects. |
| `purge-trash` | daily 03:00 | Hard-delete soft-deleted content older than 30 d (incl. their MediaRef rows). |
Upload failure handling: object writes occur before the DB row; on DB failure the API deletes written objects (compensating action); on object-write failure nothing is persisted.

---

# 6. REST API specification

Base: `https://<domain>/api/v1`. JSON UTF-8. Dates ISO-8601 UTC. IDs UUID v7.

## 6.1 Conventions

### 6.1.1 Versioning and docs
- URI version `/api/v1`. Breaking changes => `/api/v2` side by side. Non-breaking additions allowed in v1.
- OpenAPI 3.1 generated from decorators (`@ApiTags`, `@ApiOperation`, DTO schemas via Swagger CLI plugin). JSON at `/api/v1/openapi.json`; UI at `/api/docs` (dev + when `SWAGGER_ENABLED=true`). CI step regenerates the spec and fails on diff vs the committed `apps/api/openapi.snapshot.json` (contract guard).
- Tags: `public-*`, `admin-*`, `auth`, `health`.

### 6.1.2 Pagination (lists)
Query: `page` (default 1, min 1), `pageSize` (default 20, max 100). Response envelope:
```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 } }
```
Single resources return the object directly (no envelope) — `{ ... }`. Non-paginated small collections (menus, categories, brands for marquee, settings) return `{ "data": [...] }` without `meta`.

### 6.1.3 Filtering, sorting, search
- `q` = free-text (admin lists: ILIKE on title/name; public product list: FTS).
- `sort` = comma list of fields, `-` prefix for descending, whitelist per resource, e.g. `sort=-publishedAt,title`. Default per resource documented below.
- Admin list common filters: `status` (CSV of `ContentStatus`), `deleted=true` (trash view), `createdFrom`, `createdTo`, resource-specific filters.
- Unknown query params => 400 `VALIDATION_FAILED` (forbidNonWhitelisted).
- Field selection: not supported (YAGNI).

### 6.1.4 Error format (all errors)
```json
{
  "statusCode": 422,
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [ { "field": "email", "message": "email must be an email", "code": "isEmail" } ],
  "requestId": "01JD...",
  "timestamp": "2026-11-27T10:00:00.000Z",
  "path": "/api/v1/public/contact"
}
```
Status/code catalogue: 400 `BAD_REQUEST`, `UNSUPPORTED_LOCALE`, `INVALID_YOUTUBE_URL`, `RESET_TOKEN_INVALID`; 401 `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `REFRESH_INVALID`, `REFRESH_REUSE`, `REFRESH_RACE`; 403 `FORBIDDEN`, `CSRF_INVALID`, `ORIGIN_REQUIRED`, `PASSWORD_CHANGE_REQUIRED`, `TWO_FA_SETUP_REQUIRED`, `CAPTCHA_FAILED`; 404 `NOT_FOUND`; 409 `SLUG_TAKEN`, `SLUG_RESERVED`, `VERSION_CONFLICT`, `MEDIA_IN_USE`, `REDIRECT_LOOP`, `CONFLICT`, `SYSTEM_RESOURCE_PROTECTED`; 413 `PAYLOAD_TOO_LARGE`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `VALIDATION_FAILED`, `BLOCK_INVALID`, `HTML_REJECTED` (only when sanitize empties a required field); 423 `ACCOUNT_LOCKED`; 429 `RATE_LIMITED`; 500 `INTERNAL`; 503 `NOT_READY`. Validation errors use HTTP 422 (not 400) with `details[]`.

### 6.1.5 Caching headers (public API)
- `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` on all public GET; `private, no-store` on admin/auth; `ETag` (weak, hash of body) with `If-None-Match` => 304.
- `Vary: Accept-Encoding`. Responses gzip/br compressed by the proxy.
- Server-side in-process cache (`CacheService.wrap`) keyed by `url+locale`, TTL 60 s, invalidated by tags on content change (6.1.7).

### 6.1.6 Admin write conventions
- Create: `201` + full resource. Update (`PATCH`, partial; `PUT` only for settings/singletons/replace-lists): `200` + full resource. Delete: `204` (soft delete) ; purge: `204`.
- Optimistic concurrency: body field `expectedVersion?: number`; `409 VERSION_CONFLICT` with `details:[{field:'version', current: N}]`.
- All admin responses for content resources include `warnings: Warning[]` (non-blocking, e.g. missing alt, missing SEO description, broken references).
- Common sub-routes for every publishable resource `R` (collection path `/admin/R`): see 6.3.0.
- Idempotency: not required.

### 6.1.7 Revalidation (API -> Next.js)
- On any change affecting public output, a `content.changed` event enqueues `revalidate` job (debounced 2 s, coalescing tags/paths). Job `POST ${WEB_REVALIDATE_URL}` (e.g. `http://web:3000/api/revalidate`) with JSON `{ "tags": ["products","product:furukawa-rock-drills"], "paths": ["/products","/products/furukawa-rock-drills"], "ts": 1732700000 }` and headers `X-Revalidate-Signature: sha256=<HMAC_SHA256(REVALIDATE_SECRET, rawBody)>`, `X-Revalidate-Timestamp`. Next.js must reject if signature invalid or timestamp skew > 5 min. Retries: 5 attempts exponential (2 s, 10 s, 30 s, 2 min, 10 min); result in `RevalidationLog`. Failure never blocks the admin save.
- Tag taxonomy (also usable by Next.js `fetch(..., {next:{tags}})`): `site` (settings, menus, contact info, social, ui strings), `menus`, `page:{slug}`, `pages`, `products`, `product:{slug}`, `categories`, `brands`, `brand:{slug}`, `services`, `service:{slug}`, `videos`, `posts`, `post:{slug}`, `testimonials`, `faqs`, `subsidiaries`, `leadership`, `timeline`, `stats`, `hero`, `redirects`, `sitemap`. Mapping entity -> tags is in `common/constants/revalidation-map.ts`: e.g. product change => `products, product:{slug}, sitemap, hero`(if featured), plus pages whose blocks reference products (`page:home`); brand change => `brands, brand:{slug}, products, page:home`; settings/menus/contact => `site` (and every page implicitly since header/footer are in `site`); slug change => both old and new slugs.
- Public `GET` responses carry header `X-Cache-Tags: products,product:slug` (comma list) for frontend convenience.

### 6.1.8 Preview (drafts)
`POST /admin/preview {entityType, entityId}` -> `{ token, url }` where token is an HMAC-signed payload valid 30 min; Next.js draft-mode route calls `GET /public/preview/:entityType/:id?token=` which returns the same DTO as the public detail endpoint but ignoring `status`. `Cache-Control: no-store`.

## 6.2 Public API (no auth, read-only except contact)

All under `/api/v1/public`. Only PUBLISHED, not deleted, and (`scheduledAt` passed) content. `locale` query param optional (`en`). Common response additions: `seo` object (6.2.0).

### 6.2.0 SEO object returned with page/detail/list-root resources
```ts
interface SeoDto {
  title: string;                 // final <title>, template applied
  description: string | null;
  canonical: string;             // absolute URL
  robots: string;                // e.g. "index,follow" | "noindex,nofollow"
  openGraph: { title: string; description: string | null; type: 'website'|'article'|'product'; url: string; image: MediaDto | null; siteName: string; locale: string };
  twitter: { card: 'summary' | 'summary_large_image'; title: string; description: string | null; image: string | null; site: string | null };
  jsonLd: object[];              // overrides if set, else generated (Organization+WebSite on home, Product, BreadcrumbList, Article, FAQPage, LocalBusiness/Organization)
}
```

### 6.2.1 Endpoint table

| Method | Path | Description | Query | Response | Errors |
|--------|------|-------------|-------|----------|--------|
| GET | `/public/site` | Bootstrap for layout: settings, branding, header CTA, search config, footer text, credit, social links, contact channels, offices, menus (all locations, trees, dynamic items expanded), announcement, analytics IDs, maintenance, default SEO, ui strings map | `locale` | `SiteDto` | - |
| GET | `/public/ui-strings` | Flat map of UI strings | `locale`, `group` | `{ data: Record<string,string> }` | - |
| GET | `/public/menus` | All menus | - | `{ data: MenuDto[] }` | - |
| GET | `/public/menus/:location` | One menu (`HEADER` etc.) | - | `MenuDto` | 404 |
| GET | `/public/pages` | List published custom pages (slug, title, updatedAt) | - | `{data: PageSummaryDto[]}` | - |
| GET | `/public/pages/:slug` | Page with blocks resolved; `slug` `home`, `about`, or custom | `locale` | `PageDto` | 404 |
| GET | `/public/products` | Product list | `page,pageSize(<=48),q,category(slug),brand(slug),country(code),featured(bool),sort(order\|title\|-title\|-publishedAt)` default `sort=order` | `Paginated<ProductCardDto>` + `facets` | 400 |
| GET | `/public/products/search` | Typeahead/search (header search box) | `q` (2..80 chars), `limit` (1..10, default 8) | `{ data: ProductSearchHitDto[] }` | 400 |
| GET | `/public/products/:slug` | Product detail with images, specs, documents, related, brand, category, seo | - | `ProductDto` | 404 (+ redirect hint, 6.2.2) |
| GET | `/public/products/:slug/documents/:documentId/download` | Increment counter, `302` to presigned/public URL with `Content-Disposition: attachment` | - | 302 | 404 |
| GET | `/public/product-categories` | Category tree with product counts | - | `{data: CategoryDto[]}` | - |
| GET | `/public/product-categories/:slug` | Category + seo | - | `CategoryDto` | 404 |
| GET | `/public/brands` | Brands/partners (marquee + brands index) | `kind(PRINCIPAL\|PARTNER),page,pageSize(<=100),country` | `Paginated<BrandCardDto>` | - |
| GET | `/public/brands/:slug` | Brand detail (the old "company detail"): description, videos, products | - | `BrandDto` | 404 |
| GET | `/public/services` | Services list | - | `{data: ServiceCardDto[]}` | - |
| GET | `/public/services/:slug` | Service detail with features | - | `ServiceDto` | 404 |
| GET | `/public/videos` | Videos | `featured,brand(slug),page,pageSize(<=48)` | `Paginated<VideoDto>` | - |
| GET | `/public/testimonials` | | `limit` | `{data: TestimonialDto[]}` | - |
| GET | `/public/faqs` | FAQ groups with items | `group(slug)` | `{data: FaqGroupDto[]}` | - |
| GET | `/public/posts` | News list | `page,pageSize(<=24),category(slug),tag(slug),q,sort(-publishedAt default)` | `Paginated<PostCardDto>` | - |
| GET | `/public/posts/:slug` | News detail + prev/next + related | - | `PostDto` | 404 |
| GET | `/public/post-categories` | | - | `{data: PostCategoryDto[]}` | - |
| GET | `/public/subsidiaries` | | - | `{data: SubsidiaryDto[]}` | - |
| GET | `/public/subsidiaries/:slug` | | - | `SubsidiaryDto` | 404 |
| GET | `/public/leadership` | Primary leader message + team | - | `{ leader: LeaderMessageDto\|null, team: TeamMemberDto[] }` | - |
| GET | `/public/timeline` | | - | `{data: TimelineEntryDto[]}` | - |
| GET | `/public/stats` | | `group` | `{data: StatDto[]}` | - |
| GET | `/public/search` | Global search across products, brands, services, posts, pages | `q` (2..80), `types` (CSV), `limit` (<=10 per type) | `{ products: [...], brands: [...], services: [...], posts: [...], pages: [...] }` | 400 |
| POST | `/public/contact` | Submit contact form (see 7) | body `SubmitContactDto` | `201 { id, reference, message }` | 422, 429, 403 `CAPTCHA_FAILED` |
| GET | `/public/redirects` | All enabled redirects (for Next.js middleware, cached) | - | `{ data: {source,target,type,match}[] }` | - |
| GET | `/public/redirects/resolve` | Resolve a single path | `path` | `{ match:false } \| { match:true, target, type }` | - |
| GET | `/public/sitemap` | URL set for `sitemap.xml` generation | - | `{ data: { loc: string; lastmod: string; changefreq: string; priority: number; images?: string[] }[] }` | - |
| GET | `/public/sitemap.xml` | Ready XML (optional convenience; Next.js may proxy it) | - | `application/xml` | - |
| GET | `/public/robots.txt` | Robots text built from settings + site noindex | - | `text/plain` | - |
| GET | `/public/slugs/:type` | Slug lists for `generateStaticParams`: `type` in `products,brands,services,posts,pages,categories` | - | `{ data: {slug, updatedAt}[] }` | 404 |
| GET | `/public/preview/:entityType/:id` | Draft preview with token | `token` | same DTO as detail | 401/403 |
| GET | `/health/live`, `/health/ready` | Liveness / readiness (db, minio, jobs) | - | `{status:'ok', info:{...}}` | 503 |

### 6.2.2 Slug redirect hint
When a detail slug is unknown but a `Redirect` (auto or manual) matches the corresponding public path, the endpoint returns `404` with body `{ ..., "redirect": { "target": "/products/new-slug", "type": "MOVED_301" } }` so the frontend can `permanentRedirect`. (Primary mechanism remains Next middleware using `/public/redirects`.)

### 6.2.3 Product list facets
`facets: { categories: [{slug,name,count}], brands: [{slug,name,count}], countries: [{code,name,count}] }` computed on the filtered-without-that-facet set, cached 60 s.

### 6.2.4 Search behaviour (`/public/products/search`, `/public/search`)
- Normalise `q` (trim, collapse spaces, unaccent, lowercase); reject < 2 or > 80 chars (400).
- Query = `websearch_to_tsquery('simple', q)` with prefix matching on the last token (`:*`) for typeahead, OR trigram `similarity(title,q) > 0.3`; rank as in 3.11; ties by `sortOrder`.
- Returns `{ id, slug, title, shortDescription (truncated 140), image: MediaDto|null (w320), brand: {name,slug}|null, category }`.
- Empty result => `{data: []}` (200).
- 60 req/min/IP throttle.

### 6.2.5 Public sitemap composition
Includes: `/`, `/about`, `/products`, `/brands`, `/services`, `/news` (if posts exist), `/contact`, every published product/brand/service/post/custom page/category (unless `seo.noindex` or `SiteSettings.sitemap.excludeTypes` or `Page.showInSitemap=false`), with `lastmod = updatedAt`, `changefreq/priority` from settings per type (defaults: home 1.0 weekly; products 0.8 monthly; brands 0.7; services 0.7; posts 0.6; pages 0.5). Images (hero) included in `images[]`. Cached 5 min; tag `sitemap`.

### 6.2.6 Robots
`User-agent: *`, `Allow: /`, `Disallow: /admin`, `Disallow: /api`, `Disallow: /search`, plus `SiteSettings.robots.disallow`, extra rules, and `Sitemap: https://<domain>/sitemap.xml`. If `seoDefaults.siteNoindex` => `Disallow: /` and sitemap omitted.

## 6.3 Admin API

All under `/api/v1/admin` (+ `/auth` for identity). Require access cookie + CSRF header (unsafe methods) + `Role.ADMIN`. `Cache-Control: no-store`.

### 6.3.0 Standard endpoints (apply to every resource marked in the matrix)

For a resource at `/admin/{res}`:

| Method | Path | Purpose | Notes |
|--------|------|---------|-------|
| GET | `/admin/{res}` | List (paginated) | filters per resource; `deleted=true` shows trash |
| POST | `/admin/{res}` | Create | slug auto if missing; sanitization; revision #1; audit; event |
| GET | `/admin/{res}/:id` | Read full admin DTO incl. children, seo, `warnings[]` | |
| PATCH | `/admin/{res}/:id` | Update (partial) | revision + audit + event; `expectedVersion` |
| DELETE | `/admin/{res}/:id` | Soft delete (to trash) | 409 `SYSTEM_RESOURCE_PROTECTED` for system rows |
| POST | `/admin/{res}/:id/restore` | Restore from trash | |
| DELETE | `/admin/{res}/:id/purge` | Hard delete (only if already in trash) | |
| POST | `/admin/{res}/:id/duplicate` | Clone as DRAFT (`"Copy of ..."`, new slug) | publishable resources |
| POST | `/admin/{res}/:id/publish` | status -> PUBLISHED, `publishedAt = now` (if null) | body `{}`; validates required fields (title, shortDescription, hero image optional) |
| POST | `/admin/{res}/:id/unpublish` | -> DRAFT | |
| POST | `/admin/{res}/:id/schedule` | body `{ scheduledAt: ISO (future) }` -> SCHEDULED; job publishes at time (minute precision) | |
| POST | `/admin/{res}/:id/archive` | -> ARCHIVED | |
| PATCH | `/admin/{res}/reorder` | body `{ ids: string[] }` full ordered list of the (filtered) set; rewrites `sortOrder` | ordered resources only; 422 if ids don't match the set |
| GET | `/admin/{res}/:id/revisions` | list revisions `{id, versionNo, createdAt, author, changeNote}` | |
| GET | `/admin/{res}/:id/revisions/:revisionId` | snapshot + diff against current | |
| POST | `/admin/{res}/:id/revisions/:revisionId/restore` | restore snapshot (creates new revision) | |
| POST | `/admin/{res}/bulk` | body `{ ids, action: 'publish'\|'unpublish'\|'archive'\|'delete'\|'restore' }` | max 100 ids |

Resource matrix (which standard endpoints exist):

| `{res}` | Entity | Publish workflow | Reorder | Revisions | SEO | Duplicate | Notes |
|---------|--------|------------------|---------|-----------|-----|-----------|-------|
| `pages` | Page | yes | no (blocks reorder separately) | yes | yes | yes | system pages: no delete, slug locked |
| `products` | Product | yes | yes | yes | yes | yes | |
| `product-categories` | ProductCategory | yes | yes (within parent) | yes | yes | no | |
| `brands` | Brand | yes | yes | yes | yes | yes | |
| `services` | Service | yes | yes | yes | yes | yes | |
| `videos` | Video | yes | yes | no | no | no | |
| `posts` | Post | yes | no | yes | yes | yes | |
| `post-categories` | PostCategory | no | yes | no | yes | no | |
| `tags` | Tag | no | no | no | no | no | simple CRUD |
| `subsidiaries` | Subsidiary | yes | yes | yes | yes | no | |
| `hero-slides` | HeroSlide | yes | yes | no | no | yes | |
| `stats` | Stat | visible toggle | yes | no | no | no | |
| `timeline` | TimelineEntry | visible toggle | yes | no | no | no | |
| `core-values` | CoreValue | yes | yes | no | no | no | filter `group` |
| `leader-messages` | LeaderMessage | yes | yes | yes | no | no | one `isPrimary` |
| `team-members` | TeamMember | yes | yes | no | no | no | |
| `testimonials` | Testimonial | yes | yes | no | no | no | |
| `faq-groups` | FaqGroup | yes | yes | no | no | no | nested `faqs` below |
| `contact-channels` | ContactChannel | visible toggle | yes | no | no | no | |
| `offices` | Office | visible toggle | yes | no | no | no | |
| `social-links` | SocialLink | visible toggle | yes | no | no | no | |
| `redirects` | Redirect | enabled toggle | no | no | no | no | |
Toggle-type resources have no publish/schedule endpoints; they use `visible`/`enabled` fields in PATCH.

### 6.3.1 Auth and account (`/auth`, `/admin/me`)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/auth/login` | public | `{email, password}` | `200 {status:'OK', user, mustChangePassword, csrfToken}` or `{status:'TOTP_REQUIRED', challengeToken}` + cookies | 401 `INVALID_CREDENTIALS`, 423 `ACCOUNT_LOCKED`, 429 |
| POST | `/auth/login/totp` | public | `{challengeToken, code?: string(6), recoveryCode?: string}` | as login OK | 401, 423, 429 |
| POST | `/auth/refresh` | refresh cookie + CSRF | - | `200 {user, csrfToken}` + cookies | 401 `REFRESH_*` |
| POST | `/auth/logout` | access | - | 204 | |
| POST | `/auth/logout-all` | access | - | 204 | |
| GET | `/auth/me` | access | - | `MeDto` | 401 |
| POST | `/auth/forgot-password` | public | `{email}` | `202 {message}` | 429 |
| POST | `/auth/reset-password/validate` | public | `{token}` | `{valid}` | 429 |
| POST | `/auth/reset-password` | public | `{token, newPassword}` | 204 | 400 `RESET_TOKEN_INVALID`, 422 weak password |
| POST | `/auth/change-password` | access | `{currentPassword, newPassword}` | 204 (fresh cookies set) | 401/422 |
| GET | `/auth/sessions` | access | - | `{data: SessionDto[]}` | |
| DELETE | `/auth/sessions/:id` | access | - | 204 | 404 |
| POST | `/auth/2fa/setup` | access | `{password}` | `{otpauthUri, secretBase32}` | 401/409 already enabled |
| POST | `/auth/2fa/enable` | access | `{code}` | `{recoveryCodes: string[10]}` | 400 invalid code |
| POST | `/auth/2fa/disable` | access | `{password, code?, recoveryCode?}` | 204 | |
| POST | `/auth/2fa/recovery-codes/regenerate` | access | `{password, code}` | `{recoveryCodes}` | |
| PATCH | `/admin/me` | access | `{name?, avatarMediaId?}` | `MeDto` | |
Email change is NOT supported via API in v1 (CLI only) to keep the account takeover surface minimal.

### 6.3.2 Dashboard
`GET /admin/dashboard` -> 
```ts
{ counts: { products:{total,published,draft,scheduled}, brands:{...}, services:{...}, posts:{...}, pages:{...}, videos:{total}, media:{total, sizeBytes} },
  messages: { new: number, total: number, last7d: number[] /*daily counts*/ },
  recentMessages: MessageSummaryDto[5], recentActivity: AuditSummaryDto[10], upcomingScheduled: {entityType,id,title,scheduledAt}[],
  health: { db:'ok', storage:'ok', mail:'ok'|'unconfigured'|'failing', jobsBacklog: number, lastRevalidation:{status,at} },
  warnings: { missingImages: {entityType,id,title}[], missingSeoDescription: number, unusedMedia: number, draftOlderThan30d: number, socialLinksMissing: boolean } }
```

### 6.3.3 Pages and blocks (`/admin/pages`)
Standard endpoints plus:

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/admin/pages/by-key/:key` | - | page by system key (`home`, `about`) with blocks |
| GET | `/admin/pages/:id/blocks` | - | `PageBlockAdminDto[]` |
| POST | `/admin/pages/:id/blocks` | `{type, data, anchorId?, navLabel?, showInTabNav?, visible?, sortOrder?}` | 201 block; 422 `BLOCK_INVALID` with zod issues in `details` |
| PATCH | `/admin/pages/:id/blocks/:blockId` | partial | block |
| DELETE | `/admin/pages/:id/blocks/:blockId` | - | 204 (hard delete; revision of page saved) |
| PATCH | `/admin/pages/:id/blocks/reorder` | `{ids: string[]}` | 204 |
| POST | `/admin/pages/:id/blocks/:blockId/duplicate` | - | block |
| GET | `/admin/block-types` | - | `{data:[{type, label, description, jsonSchema, defaultData}]}` (JSON Schema generated from zod; drives the dashboard block editor) |
| PUT | `/admin/pages/:id/blocks` | `{blocks: [...]}` | replace entire ordered list atomically (used by the visual editor "Save") |
Create page body: `{title, slug?, template?, heroTitle?, heroSubtitle?, heroImageMediaId?, showInSitemap?, seo?: SeoMetaInput, blocks?: BlockInput[]}`. For custom pages with simple text the default is a single `RICH_TEXT` block.

### 6.3.4 Catalogue endpoints

**Products** (`/admin/products`) — standard + :

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/admin/products` | filters `status,q,brandId,categoryId,featured,countryCode,missingImage(bool),sort` | list of `ProductAdminListItem` |
| PUT | `/admin/products/:id/images` | `{images: {mediaId, caption?, altOverride?}[]}` | replace gallery in order (max 30) |
| PUT | `/admin/products/:id/specs` | `{specs: {groupName?, label, value, unit?}[]}` | replace (max 100) |
| PUT | `/admin/products/:id/documents` | `{documents: {title, mediaId, language?}[]}` | replace (max 20; media must be kind DOCUMENT) |
| PUT | `/admin/products/:id/related` | `{relatedIds: string[]}` | max 8 |
| PATCH | `/admin/products/:id/feature` | `{isFeatured: boolean}` | quick toggle |
Create/PATCH body (`ProductInput`): `{title, slug?, shortDescription, contentHtml?, heroImageMediaId?, brandId?, categoryId?, extraCategoryIds?, countryCode?, countryName?, originCity?, isFeatured?, inquiryEnabled?, partNumber?, tagline?, seo?, images?, specs?, documents?, relatedIds?, expectedVersion?}` (nested arrays optional — if present they replace).

**Product categories**, **Brands** (`/admin/brands`: body `{name, slug?, kind, shortDescription, descriptionHtml?, logoMediaId?, logoDarkMediaId?, heroImageMediaId?, countryCode?, countryName?, city?, websiteUrl?, showInMarquee?, isFeatured?, seo?}`; extra `GET /admin/brands/:id/products` and `GET /admin/brands/:id/videos`), **Services** (`{title, slug?, shortDescription, bodyHtml?, imageMediaId?, iconName?, ctaLabel?, ctaHref?, features: {title, description?}[], seo?}`; features replaced when provided), **Videos** (`{title, description?, url, thumbnailMediaId?, brandId?, productId?, isFeatured?}`; server parses `url`, 422 `INVALID_YOUTUBE_URL` when no ID found; returns `youtubeId`, `startSeconds`).

### 6.3.5 Editorial and about-page content
`posts` (`{title, slug?, excerpt, bodyHtml, coverMediaId?, authorName?, categoryId?, tagIds?|tags?: string[] (names auto-created), isFeatured?, publishedAt?, seo?}`), `post-categories`, `tags`, `testimonials` (`{quote, personName, personRole?, companyName?, photoMediaId?, rating?}`), `faq-groups` (+ nested: `GET/POST /admin/faq-groups/:id/faqs`, `PATCH/DELETE /admin/faq-groups/:id/faqs/:faqId`, `PATCH /admin/faq-groups/:id/faqs/reorder`), `subsidiaries` (`{name, slug?, legalName?, kind, countryCode, regionNote?, tagline?, introHtml, bodyHtml?, lists: {title, style, items: string[]}[], brandLinks: {brandId, relation}[], logoMediaId?, imageMediaId?, websiteUrl?, seo?}`), `leader-messages` (`{heading, name?, jobTitle?, photoMediaId?, signatureMediaId?, messageHtml, isPrimary?}`; setting `isPrimary=true` unsets others in the same transaction), `team-members`, `timeline` (`{yearLabel, startYear?, title, description?, imageMediaId?, icon?, visible}`), `core-values` (`{group, title, description?, icon?}`), `stats` (`{value, prefix?, suffix?, label, icon?, group?, visible}`), `hero-slides` (`{eyebrow?, heading, subheading?, imageMediaId, mobileImageMediaId?, overlayOpacity?, button1Label?, button1Href?, button2Label?, button2Href?, productId?, brandId?, startsAt?, endsAt?, visible}`).

### 6.3.6 Site settings, UI strings, navigation, contact info

| Method | Path | Body | Response / notes |
|--------|------|------|------------------|
| GET | `/admin/settings` | - | `SiteSettingsAdminDto` (all JSON groups + media DTOs) |
| PUT | `/admin/settings` | full `UpdateSiteSettingsDto` (all groups optional; provided groups replaced) | 200; revision + audit `SETTINGS_UPDATE`; revalidates tag `site` |
| PATCH | `/admin/settings/{group}` | group in `branding`,`header`,`footer`,`seo`,`analytics`,`maintenance`,`announcement`,`contact-form`,`robots`,`sitemap` | partial update per group |
| GET | `/admin/settings/revisions`, `.../:revisionId`, `POST .../:revisionId/restore` | | revisions of settings |
| GET | `/admin/ui-strings` | `?group=&q=` | `{data: {id,key,value,group,locale,description}[]}` |
| PUT | `/admin/ui-strings` | `{ items: {key, value, locale?}[] }` (bulk upsert, max 200; unknown keys allowed only if key matches `^[a-z0-9]+(\.[a-zA-Z0-9]+)+$`) | 200 |
| DELETE | `/admin/ui-strings/:id` | | reverts to default (seed default kept in code `ui-strings.defaults.ts`) |
| GET | `/admin/menus` | | all menus with items |
| GET | `/admin/menus/:location` | | menu + tree |
| PUT | `/admin/menus/:location/items` | `{items: MenuItemInput[]}` nested tree (`{id?, type, label, pageId?, entityType?, entityId?, href?, target?, icon?, config?, visible, children?: MenuItemInput[]}`), replaces whole menu atomically, validates depth <= 2 and referenced entities exist | 200 menu |
| CRUD | `/admin/contact-channels`, `/admin/offices`, `/admin/social-links` | per 6.3.0 matrix | `social-links`: `url` required to make `visible=true` (422) |
| GET | `/admin/seo-preview` | `?entityType=&id=` | returns resolved `SeoDto` for SERP/OG preview in the editor |

### 6.3.7 Media library

| Method | Path | Body / query | Response / errors |
|--------|------|--------------|-------------------|
| POST | `/admin/media` | multipart: `file` (1..10 files), optional `folderId`, `alt`, `title`, `intent` (`IMAGE`\|`ICON`\|`DOCUMENT`), `visibility` (`PUBLIC`\|`PRIVATE`, documents only) | `201 MediaAdminDto[]` (per-file result with `error` object for failures; HTTP 207 when mixed); 413, 415 |
| GET | `/admin/media` | `q, kind, folderId, unused(bool), visibility, page, pageSize(<=100), sort(-createdAt)` | `Paginated<MediaAdminDto>` |
| GET | `/admin/media/:id` | | `MediaAdminDto` incl. `variants`, `usage: {entityType, entityId, title, field}[]`, `duplicates: id[]` (same sha256) |
| PATCH | `/admin/media/:id` | `{alt?, caption?, title?, folderId?, focalX?, focalY?}` | |
| PUT | `/admin/media/:id/file` | multipart `file` | Replace file keeping id (new `v{n}`), regenerates variants; same kind required |
| DELETE | `/admin/media/:id` | `?force=bool` | 204; 409 `MEDIA_IN_USE` with usage list |
| POST | `/admin/media/bulk` | `{ids, action:'move'\|'delete', folderId?}` | 200 |
| GET | `/admin/media/:id/download` | | streams original (admin only; private docs) |
| GET/POST/PATCH/DELETE | `/admin/media-folders[/:id]` | `{name, parentId?}` | delete only if empty (409) |
| POST | `/admin/media/:id/regenerate` | | re-run variants |
`MediaAdminDto` = `MediaDto` + `{ originalName, mimeType, sizeBytes, sha256, visibility, folderId, processingStatus, createdAt, uploadedBy, usageCount }`.

### 6.3.8 Messages inbox (`/admin/messages`)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/admin/messages` | `status` (CSV), `starred`, `q`, `from`, `to`, `productId`, `page`, `pageSize`, `sort` (`-createdAt`) | `Paginated<MessageListItemDto>` + `meta.counts: {NEW,READ,REPLIED,ARCHIVED,SPAM}` |
| GET | `/admin/messages/:id` | - | `MessageDto` (auto marks `NEW` -> `READ` when `?markRead=true`, default true for first view) |
| PATCH | `/admin/messages/:id` | `{status?, isStarred?}` | `MessageDto` (audit `MESSAGE_STATUS`) |
| POST | `/admin/messages/:id/notes` | `{body}` | 201 note |
| DELETE | `/admin/messages/:id/notes/:noteId` | | 204 |
| POST | `/admin/messages/:id/reply` | `{subject, body}` plain text | sends email via SMTP to sender (Reply-To = notify address), stores note `kind=REPLY`, status -> `REPLIED`, `repliedAt`; 202 (queued) |
| POST | `/admin/messages/:id/mark-spam` | | status `SPAM`; also adds `email` to temp spam list (in-memory 24 h) |
| POST | `/admin/messages/:id/not-spam` | | status -> `READ` |
| POST | `/admin/messages/bulk` | `{ids, action:'read'\|'archive'\|'spam'\|'delete'\|'star'\|'unstar'}` | 200 `{affected}` |
| DELETE | `/admin/messages/:id` | | hard delete 204 |
| GET | `/admin/messages/export.csv` | same filters | CSV (`text/csv`), formula-injection safe (cells beginning with `= + - @` prefixed by `'`) |
| GET | `/admin/messages/unread-count` | | `{count}` (header badge; frontend polls every 60 s) |

### 6.3.9 Redirects (`/admin/redirects`)
Standard CRUD (no publish) +:

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/admin/redirects/test` | `{path}` | returns resolution chain and detects loops |
| POST | `/admin/redirects/import` | multipart CSV `source,target,type,match` (max 1000 rows) with `?dryRun=true` | per-row result; invalid rows reported |
| GET | `/admin/redirects/export.csv` | | CSV |
Validation: normalised source; target not equal to source; no loop (DFS depth 10); `409 REDIRECT_LOOP`; `auto=true` rows are editable but deleting the entity does not delete them.

### 6.3.10 Audit, revisions, revalidation, preview, import/export, system

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/audit-logs` | filters `actorId, action, entityType, entityId, from, to, q`, paginated, `sort=-createdAt` |
| GET | `/admin/revisions/:entityType/:entityId` | alias of per-resource revision listing |
| POST | `/admin/revalidate` | `{ scope: 'ALL' \| 'TAGS', tags?: string[] }` -> 202; logs `REVALIDATE` |
| GET | `/admin/revalidation-logs` | last 100 |
| POST | `/admin/preview` | see 6.1.8 |
| GET | `/admin/export` | `?include=settings,pages,products,...` (default all content, NOT users/messages/audit) -> `application/json` bundle `{version:1, exportedAt, entities:{...}, mediaManifest:[{id,objectKey,originalName,sha256}]}`; media binaries are not included (backup via MinIO mirror); audit `EXPORT` |
| POST | `/admin/import` | multipart bundle JSON, `?dryRun=true` (default true) `&mode=merge|replace-content`; validates every entity with its DTO, reports `{created, updated, skipped, errors[]}`; apply requires `dryRun=false` and `confirm=IMPORT`; max 10 MB; audit `IMPORT` |
| GET | `/admin/export/messages.csv` | alias of messages export |
| GET | `/admin/system/info` | `{version, commit, node, uptime, db:{size}, storage:{usedBytes}, jobs:{queued,failed}, smtp:{configured}}` |
| POST | `/admin/system/test-email` | `{to}` sends a test mail (throttled 5/hour) |
| POST | `/admin/trash/purge` | `{entityType?}` purge older-than-0 trash now (confirm param `confirm=PURGE`) |
| GET | `/admin/trash` | cross-entity trash list `{entityType,id,title,deletedAt}` |

## 6.4 Behavioural rules shared by admin writes

1. Sanitize all `*Html` fields on write (4.9). Reject (`422 HTML_REJECTED`) only if a required rich field becomes empty after sanitizing.
2. Slug rules (3.3); slug change on PUBLISHED creates auto-redirect.
3. Referenced IDs (media, brand, category, product, page) are validated to exist and not be deleted (422 with `details`).
4. Maintain `MediaRef` index for every media-bearing field and for `<img src>` inside sanitized HTML.
5. After successful write in the same DB transaction: insert `ContentRevision` (if resource has revisions), `AuditLog`; after commit: emit `content.changed` (revalidation + cache invalidation).
6. Status transitions allowed: `DRAFT -> PUBLISHED|SCHEDULED|ARCHIVED`, `SCHEDULED -> PUBLISHED|DRAFT`, `PUBLISHED -> DRAFT|ARCHIVED|SCHEDULED`, `ARCHIVED -> DRAFT|PUBLISHED`. A SCHEDULED item becomes PUBLISHED by the `publish-scheduled` job (every minute, `SELECT ... FOR UPDATE SKIP LOCKED`), sets `publishedAt = scheduledAt`, emits event, writes audit (actor `SYSTEM`).
7. Publishing validation (blocks publish with 422): product/brand/service/post require non-empty `title` and `shortDescription`/`excerpt`; post requires `bodyHtml`; page requires at least one visible block (except if `RICH_TEXT` content present).
8. Public output filters: `status=PUBLISHED`, `deletedAt IS NULL`, `publishedAt <= now()`.
9. Dynamic menu items resolve against published entities at read time.
10. `PATCH` with unchanged values still bumps nothing (no-op detection: if diff empty -> 200 without revision/audit/event).

## 6.5 UI string key catalogue (used by `GET /public/ui-strings`)

Groups: `common`, `nav`, `footer`, `home`, `about`, `products`, `product`, `services`, `contact`, `search`, `notFound`, `errors`, `news`. Defaults live in `apps/api/src/settings/ui-strings.defaults.ts` (code) and are seeded; public API returns defaults merged with DB overrides so a missing DB row never yields an empty label. Frontend MUST NOT hard-code user-visible strings that exist as keys.

---

# 7. Contact form pipeline

## 7.1 Request

`POST /api/v1/public/contact` (public, JSON).
```ts
interface SubmitContactDto {
  name: string;            // 2..120, trimmed, no control chars
  email: string;           // valid email, <= 254, lowercased
  phone?: string;          // optional, 6..40, pattern ^[+0-9 ()\-.]{6,40}$
  message: string;         // 10..5000
  subject?: string;        // <= 160 (optional; frontend may omit)
  productSlug?: string;    // optional context ("Request a quote" on a product page)
  sourcePath?: string;     // optional, must start with '/', <= 300
  consent?: boolean;       // required true only when settings.contactForm.consentRequired
  website?: string;        // HONEYPOT (hidden field, MUST be empty/absent)
  formStartedAt?: number;  // epoch ms when form rendered (time-trap)
  captchaToken?: string;   // required when settings.contactForm.captchaProvider != 'NONE'
}
```

## 7.2 Pipeline (ordered; reject early, cheaply)

1. **Throttle** (IP 5/hour, 20/day; email 3/hour) -> 429 `RATE_LIMITED`.
2. **Validate** DTO -> 422 with `details[]`. Strip HTML tags and control chars from `name`, `subject`, `message` (stored as plain text; never rendered as HTML anywhere, including the admin UI and emails, which use escaped output).
3. **Honeypot**: if `website` non-empty -> respond `201` with a fake success (`{id:null, reference:null}`) and store nothing except an internal log counter (bots learn nothing).
4. **Time trap**: if `formStartedAt` present and `now - formStartedAt < 3000 ms` -> treat as spam (store with status `SPAM`, no notification) but still respond 201.
5. **Captcha** (when enabled): verify token server-side with provider (Turnstile `https://challenges.cloudflare.com/turnstile/v0/siteverify`, hCaptcha `https://hcaptcha.com/siteverify`), passing remote IP; failure -> 403 `CAPTCHA_FAILED`; provider timeout (3 s) -> fail OPEN with extra spam score +3 if the provider is down, so real customers can still write (logged).
6. **Spam scoring** (`SpamService`, sum; >= 5 => `SPAM`): links count > 2 (+2), contains common spam phrases list (+2, list in code, extendable via settings later), disposable email domain list (+2), name == email local part with digits (+1), identical message from same IP in last 24 h (+3, duplicate guard), email on temporary spam list (+5), message length < 15 with URL (+2). Reasons stored in `spamReasons`.
7. **Resolve product** context: `productSlug` -> `productId` + `productTitleSnapshot` (ignore silently if unknown).
8. **Persist** `ContactMessage` (`status NEW` or `SPAM`), generate `reference`.
9. **Notify** (not for SPAM): enqueue `send-email` job `contact-notification` to `settings.contactForm.notifyTo` (fallback env `CONTACT_NOTIFY_TO`); email contains reference, name, email, phone, product, message (escaped), link to `${ADMIN_URL}/admin/messages/{id}`; `Reply-To` = sender email; `From` = `MAIL_FROM`. Optional auto-reply to sender if `autoReplyEnabled` (text from settings; plain text; no message echo). Email failure does not fail the request; `notificationStatus` updated by job (retries 5x).
10. Respond `201 { id, reference, message: <successMessage from settings/ui-string contact.success> }`.

## 7.3 Inbox states and UX rules

| State | Meaning | Transitions by admin |
|-------|---------|----------------------|
| `NEW` | unseen | -> `READ` (auto on open), `SPAM`, `ARCHIVED` |
| `READ` | seen | -> `REPLIED`, `ARCHIVED`, `SPAM` |
| `REPLIED` | reply email sent or manually marked | -> `ARCHIVED`, `READ` |
| `ARCHIVED` | hidden from default view | -> `READ` |
| `SPAM` | filtered; excluded from unread count and counts badge | -> `READ` ("not spam") |
Default list view = `NEW,READ,REPLIED`; tabs for Archived and Spam; star flag; internal notes (chronological); reply composer (plain text, sent through SMTP, stored as `REPLY` note); bulk actions; CSV export; unread badge from `/admin/messages/unread-count`. SPAM and ARCHIVED messages older than 180 days purged by job `purge-messages` only if `MESSAGES_RETENTION_DAYS` is set (default unset = keep).

---

# 8. Non-functional design

## 8.1 Performance and caching

| Layer | Strategy |
|-------|----------|
| Next.js | ISR/`fetch` tags; public API called server-to-server over internal network |
| HTTP | `Cache-Control: s-maxage=60, stale-while-revalidate=300`, ETag; proxy may cache public GETs 30 s (Caddy cache module optional) |
| API in-process cache | `CacheService.wrap(key, tags, ttl=60s)` for public read models; invalidated via tags on `content.changed`; max 500 entries LRU |
| DB | Indexes listed in section 3; `select` projections for cards; N+1 avoided through `include` with explicit relation sets; pagination mandatory; `EXPLAIN` review for list+search queries; connection pool 10 (`DATABASE_POOL_MAX`) |
| Images | Variants + `blurhash` + immutable caching; AVIF/WebP |
| Compression | Done at proxy (gzip/br); API compression middleware only when proxy absent |
| Budgets | Public GET p95 < 80 ms cached / < 250 ms uncached at 50 rps on 2 vCPU; search p95 < 150 ms with 1k products; admin list p95 < 300 ms |
| Jobs | pg-boss concurrency: email 3, revalidate 2, image-variants 2 (sharp concurrency limited via `sharp.concurrency(2)`) |

## 8.2 Observability

- **Logging**: `nestjs-pino`, JSON to stdout, `requestId` (`X-Request-Id` accepted if valid ULID/UUID else generated; echoed in response), levels via `LOG_LEVEL`, redaction (4.9), request log includes method, route template, status, duration, userId (if any). Health routes excluded from access logs.
- **Metrics** (optional but planned): `/metrics` Prometheus endpoint (`prom-client`) bound to internal network only (`METRICS_ENABLED`), exposing HTTP histograms, pg-boss queue depth, login failures, contact submissions, revalidation failures.
- **Error tracking**: optional Sentry (`SENTRY_DSN`), scrubbing same as logs.
- **Health**: `GET /health/live` (process up), `GET /health/ready` (DB `SELECT 1`, MinIO bucket stat, pg-boss started; SMTP not blocking). Compose healthchecks use these.
- **Audit**: DB audit log (6.3.10) is the business-level trail; app logs are operational.
- **Alerts** (ops, later): uptime check on `/health/ready`; disk usage > 80 %; backup job failure (backup container exits non-zero and writes `/backups/LAST_STATUS`); revalidation failure count.

## 8.3 Migrations and database operations

- Prisma Migrate (`prisma migrate dev` locally; `prisma migrate deploy` run by the API container entrypoint before start, guarded by advisory lock so only one instance migrates).
- Raw-SQL pieces (extensions, FTS triggers, partial unique indexes such as "one primary LeaderMessage", `CHECK (id='singleton')`) live in hand-authored migration files committed with the schema; a CI check runs `prisma migrate diff` to confirm schema/migrations agree.
- Naming: `YYYYMMDDHHMMSS_<snake_description>`; never edit applied migrations.
- Rollback policy: forward-only; destructive migrations (drop column) happen two releases after code stops using the column.
- Seeds are separate from migrations (3.13).

## 8.4 Backups and restore

| Item | Method | Schedule | Retention | Target |
|------|--------|----------|-----------|--------|
| PostgreSQL | `pg_dump --format=custom --compress=9` (service `backup`), plus weekly `pg_dumpall --globals-only` | daily 02:15 server time | 7 daily, 4 weekly, 6 monthly | `/backups/pg/` on a separate volume AND synced offsite |
| MinIO | `mc mirror --overwrite --remove` of `public-media` and `private-docs` to `/backups/minio/` (and offsite) ; versioned object listing manifest | daily 02:45 | mirror (latest) + weekly snapshot tarball kept 4 | local volume + offsite |
| Offsite | `rclone` (or `mc`) to an S3-compatible bucket (Backblaze B2 / Wasabi / another VPS) with client-side encryption (`crypt`) | after each local backup | per provider lifecycle | env `OFFSITE_*` |
| Config | `.env` and compose files copied encrypted (`age`) | weekly | 4 | offsite |
| Verification | Weekly automated restore test: restore latest dump into a throwaway Postgres container, run `SELECT count(*)` sanity checks on key tables, write result to `/backups/LAST_RESTORE_CHECK` | weekly | - | - |
Restore runbook (documented in `deploy/README-ops.md` at implementation): stop api/web, `pg_restore --clean --if-exists -d barathon dump`, `mc mirror` back, start services, run `cli db:check`, trigger `/admin/revalidate` scope ALL.
RPO <= 24 h, RTO <= 2 h.

## 8.5 Environment variable catalogue (`.env.example`)

```dotenv
# ---------- General ----------
NODE_ENV=development                  # development | production | test
APP_NAME=barathon-api
APP_VERSION=0.1.0
PORT=4000
LOG_LEVEL=info                        # trace|debug|info|warn|error
TRUST_PROXY=1                         # number of proxy hops
TZ=UTC

# ---------- URLs / CORS ----------
PUBLIC_SITE_URL=http://localhost:3000            # canonical site origin (used for canonical/sitemap/emails)
ADMIN_URL=http://localhost:3000                  # origin hosting /admin (reset links)
ALLOWED_ORIGINS=http://localhost:3000            # comma list, exact origins
API_PUBLIC_URL=http://localhost:3000/api/v1      # as seen by browsers
PUBLIC_MEDIA_BASE_URL=http://localhost:3000/media
REDIRECT_ALLOWED_HOSTS=localhost                 # comma list for absolute redirect targets
INTERNAL_API_KEY=change-me-32+chars              # Next.js server -> API (rate-limit bypass for SSR)

# ---------- Database ----------
DATABASE_URL=postgresql://barathon:password@localhost:5432/barathon?schema=public
DATABASE_POOL_MAX=10
DB_AUTO_MIGRATE=true                             # run `migrate deploy` on boot (prod compose: true)

# ---------- MinIO / S3 ----------
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=barathon-api
MINIO_SECRET_KEY=change-me
MINIO_REGION=us-east-1
MINIO_BUCKET_PUBLIC=public-media
MINIO_BUCKET_PRIVATE=private-docs
MINIO_PRESIGN_TTL_SECONDS=300

# ---------- Auth ----------
JWT_ACCESS_SECRET=change-me-min-32-chars         # or JWT_ACCESS_SECRET_FILE
ACCESS_TTL_SECONDS=900
REFRESH_IDLE_DAYS=14
SESSION_ABSOLUTE_DAYS=30
COOKIE_SECURE=false                              # true in production (https)
COOKIE_SAMESITE_ACCESS=lax
ALLOW_BEARER=false
PASSWORD_PEPPER=change-me-min-32-chars
ARGON2_MEMORY_KIB=65536
ARGON2_TIME_COST=3
HIBP_CHECK=true
APP_ENCRYPTION_KEY=base64-32-bytes               # AES-256-GCM key for TOTP secrets
REQUIRE_2FA=false
NEW_LOGIN_ALERT=true
LOGIN_MAX_FAILURES=5
LOCKOUT_BASE_MINUTES=15
ADMIN_BOOTSTRAP_EMAIL=                           # optional first-run only
ADMIN_BOOTSTRAP_PASSWORD=                        # optional first-run only (remove after)

# ---------- Mail ----------
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Barathon Trading <no-reply@example.com>"
CONTACT_NOTIFY_TO=admin@example.com              # fallback recipient(s), comma list

# ---------- Captcha ----------
CAPTCHA_PROVIDER=NONE                            # NONE|TURNSTILE|HCAPTCHA (overridden by settings)
CAPTCHA_SECRET=
FORGOT_CAPTCHA=false

# ---------- Revalidation (API -> Next.js) ----------
WEB_REVALIDATE_URL=http://localhost:3000/api/revalidate
REVALIDATE_SECRET=change-me-min-32-chars
PREVIEW_SECRET=change-me-min-32-chars

# ---------- Observability ----------
SWAGGER_ENABLED=true
METRICS_ENABLED=false
SENTRY_DSN=

# ---------- Seed ----------
SEED_ASSET_HOSTS=res.cloudinary.com
SEED_DOWNLOAD_TIMEOUT_MS=15000

# ---------- Retention ----------
AUDIT_RETENTION_DAYS=365
TRASH_RETENTION_DAYS=30
MESSAGES_RETENTION_DAYS=
MESSAGE_IP_TRUNCATE_DAYS=90
```
Compose-only vars (`deploy/.env`): `DOMAIN`, `ACME_EMAIL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `NEXT_PUBLIC_*` (frontend plan), `BACKUP_*`, `OFFSITE_*`. Env validation (zod) fails boot with a readable list of missing/invalid variables; in `production` also refuses placeholder values (`change-me*`), `COOKIE_SECURE=false`, `ALLOW_BEARER=true`.

## 8.6 Docker / Compose design for later VPS deployment (design only)

Services (network `barathon_net`, one external port set only on the proxy: 80/443):

| Service | Image | Notes |
|---------|-------|-------|
| `proxy` | `caddy:2` | Automatic HTTPS (Let's Encrypt, `DOMAIN`, `ACME_EMAIL`); routes: `/api/*` -> `api:4000`; `/media/*` -> `minio:9000` with path rewrite `/media/*` -> `/public-media/media/*` (only GET/HEAD allowed) ; everything else -> `web:3000`; security headers (HSTS, nosniff), gzip/zstd, `request_body max_size 30MB` for `/api/*`; blocks `/api/docs` unless enabled; access log JSON |
| `web` | built from `apps/web` (Next.js standalone output) | env `API_INTERNAL_URL=http://api:4000/api/v1`, `REVALIDATE_SECRET`, `INTERNAL_API_KEY`; healthcheck |
| `api` | built from `apps/api` (multi-stage; node:22-slim; runs as `node` user; `prisma migrate deploy` in entrypoint; `sharp` prebuilt) | depends_on `postgres` (healthy), `minio` (healthy); healthcheck `GET /api/v1/health/ready`; `restart: unless-stopped`; `read_only: true` with tmpfs `/tmp`; resources limit 1 GB |
| `postgres` | `postgres:16-alpine` | volume `pg_data`; `POSTGRES_*`; healthcheck `pg_isready`; not exposed; `shared_buffers` tuned small; `max_connections=50` |
| `minio` | `minio/minio` (pinned release) | volume `minio_data`; console on `127.0.0.1:9001` only (SSH tunnel); API not exposed publicly; `MINIO_BROWSER_REDIRECT_URL` unset |
| `minio-init` | `minio/mc` one-shot | creates buckets, applies anonymous-read policy on `public-media/media/*`, creates least-privilege service account `barathon-api` (readwrite on both buckets) |
| `backup` | custom small image (`postgres-client`, `mc`, `rclone`, `age`, `cron`) | schedules 8.4; volumes `backups`, read-only access to `pg`/`minio` over network |
| `mailpit` (dev compose only) | `axllent/mailpit` | local SMTP sink at 1025, UI 8025 |
Volumes: `pg_data`, `minio_data`, `caddy_data`, `caddy_config`, `backups`. Compose files: `deploy/compose.yml` (base), `deploy/compose.dev.yml` (ports open, mailpit, hot reload mounts), `deploy/compose.prod.yml` (restart policies, resource limits, secrets). Docker secrets (`secrets:` + `*_FILE` env) used for DB password, JWT secret, MinIO keys, SMTP password in production. Logs: `json-file` driver with `max-size 10m, max-file 5`. Firewall: ufw allow 22 (key-only SSH), 80, 443. Updates: `docker compose pull && up -d` with `docker image prune`. Zero-downtime is not a goal (single instance); migrations are backward-compatible.

Request routing map:
```
https://DOMAIN/            -> web
https://DOMAIN/admin/*     -> web (admin dashboard pages; calls /api/v1 with cookies)
https://DOMAIN/api/v1/*    -> api
https://DOMAIN/media/*     -> minio public-media/media/*
https://DOMAIN/sitemap.xml, /robots.txt -> web (Next route handlers proxy /public/sitemap, /public/robots.txt)
```

---

# 9. Testing strategy and acceptance checklist

## 9.1 Strategy

| Level | Tooling | Scope | Gate |
|-------|---------|-------|------|
| Unit | Jest | slug generator, HTML sanitizer, YouTube parser, country normaliser, typo-fix engine, password policy, lockout math, token service, CSRF compare, block zod schemas (valid/invalid per type), redirect loop detector, spam scoring, sitemap builder, revalidation-tag mapper | >= 85 % line coverage on `auth`, `common/utils`, `pages` block schemas |
| Integration (DB) | Jest + Testcontainers Postgres 16 + MinIO container | each service against real DB: soft-delete extension, search SQL, status transitions, scheduled-publish job, revisions, MediaRef maintenance, media pipeline with sample images | all green in CI |
| E2E (HTTP) | Supertest against the booted Nest app with the same containers | every endpoint in section 6 happy path + main error codes + auth/CSRF/rate-limit paths + public caching headers | all green in CI; OpenAPI snapshot unchanged unless intentionally updated |
| Contract | `openapi.snapshot.json` + response-shape tests using `packages/contracts` zod schemas to parse real responses | frontend/back compatibility | CI diff gate |
| Security | `pnpm audit`, ESLint security rules, ZAP baseline scan against compose stack (manual/CI optional), checks in 9.3 SEC items | before each release |
| Performance smoke | `k6` script: 50 VUs on public GET set for 2 min | p95 budgets 8.1 | pre-release |
| Seed verification | Test that runs `seed` on empty DB and asserts counts and typo fixes | CI |
| Manual QA | Checklist 9.3 | release |
Test data builders in `test/factories`. Time-dependent tests use fake timers / injectable `Clock`. Email tests use an in-memory transport capturing messages. Each e2e suite starts with truncate + minimal seed. CI: GitHub Actions (lint, typecheck, unit, integration, e2e, build image).

## 9.2 Definitions for the checklist

`{API}` = `/api/v1`. "Admin session" = cookies obtained from successful `POST {API}/auth/login`; unsafe requests include `X-CSRF-Token`. "Seeded DB" = after `seed` + `seed:assets` (assets may be partially failed). Expected statuses are exact unless a range is given.

## 9.3 ACCEPTANCE CHECKLIST

### A. Platform and health
1. `GET {API}/health/live` -> 200 `{status:'ok'}` with no auth.
2. `GET {API}/health/ready` -> 200 when DB, MinIO, jobs OK; stop Postgres -> 503 `NOT_READY`.
3. Any response includes `X-Request-Id`; sending a valid `X-Request-Id` echoes it; error bodies contain the same `requestId`.
4. Unknown route `GET {API}/nope` -> 404 with the standard error format (`code: NOT_FOUND`).
5. Boot with missing/placeholder required env in `NODE_ENV=production` -> process exits non-zero with a list of offending variables.
6. `GET {API}/openapi.json` returns a valid OpenAPI 3.1 document containing every path in section 6; Swagger UI at `/api/docs` is 404 when `SWAGGER_ENABLED=false`.
7. Security headers present on API responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy` includes `frame-ancestors 'none'`, no `X-Powered-By`.
8. CORS: preflight from an origin not in `ALLOWED_ORIGINS` gets no `Access-Control-Allow-Origin`; allowed origin gets exact echo + `Allow-Credentials: true`.
9. A 500 caused by a forced exception returns generic body without stack/SQL text.
10. JSON body > 1 MB to a non-upload route -> 413 `PAYLOAD_TOO_LARGE`.
11. Malformed JSON -> 400 `BAD_REQUEST`; unknown property in body of any admin POST -> 422 `VALIDATION_FAILED` naming the property.

### B. Authentication (custom Passport)
12. No public registration: `POST {API}/auth/register`, `/auth/signup`, `/users` -> 404.
13. `cli admin:create` creates an ADMIN with argon2id hash (stored hash starts with `$argon2id$`); password < 12 chars or weak (e.g. `password1234`) is rejected by the CLI.
14. `POST /auth/login` with correct credentials -> 200 `status:'OK'`; response sets three cookies: access (`HttpOnly`, `SameSite=Lax`, `Secure` when configured), refresh (`HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`), csrf (readable, not HttpOnly). No token appears in the JSON body.
15. Wrong password -> 401 `INVALID_CREDENTIALS`; unknown email -> identical status/body/shape; response time difference between unknown and known email < 50 ms median over 20 tries (dummy hash).
16. 5 consecutive wrong passwords -> next attempt (even with correct password) -> 423 `ACCOUNT_LOCKED` with `retryAfterSeconds`; after the lock expires a correct login succeeds and the counter resets; `AuditLog` has `LOGIN_FAILED` x5 and `ACCOUNT_LOCKED`.
17. `cli admin:unlock` clears a lock immediately.
18. >10 login requests/min from one IP -> 429 `RATE_LIMITED` with `Retry-After`.
19. `GET /auth/me` with valid cookie -> 200 `MeDto`; without cookie -> 401 `UNAUTHENTICATED`; with expired access token -> 401 `TOKEN_EXPIRED`.
20. Access JWT contains `sub,sid,role,tv,exp,iss,aud` and `exp - iat = 900`; a token signed with another secret/`alg:none` is rejected 401.
21. Bearer header is ignored when `ALLOW_BEARER=false`.
22. `POST /auth/refresh` with valid refresh cookie + CSRF -> 200, new access and refresh cookies, DB shows old token `usedAt` set and a new token row with `parentId`.
23. Reusing the previous refresh token >10 s later -> 401 `REFRESH_REUSE`, the whole session is revoked (subsequent `/auth/me` -> 401), `AuditLog` has `REFRESH_REUSE_DETECTED`.
24. Reusing the previous refresh token within 10 s -> 401 `REFRESH_RACE` and the session stays valid.
25. Refresh without CSRF header -> 403 `CSRF_INVALID`.
26. Idle expiry: after 14 days (time-travel) refresh -> 401 `REFRESH_INVALID`; absolute expiry at 30 days regardless of activity.
27. Refresh tokens are stored only as sha256 hex (`tokenHash`), never plaintext (inspect DB).
28. `POST /auth/logout` -> 204, cookies cleared (Max-Age=0), session `revokedAt` set, old access token rejected within 10 s.
29. `POST /auth/logout-all` revokes every session of the user and bumps `tokenVersion`; other devices' access tokens fail.
30. `GET /auth/sessions` lists active sessions with `current:true` on exactly one; `DELETE /auth/sessions/:id` of another session -> 204 and that session's refresh fails; of another user's/unknown id -> 404.
31. Forgot password: `POST /auth/forgot-password` for existing and non-existing emails -> identical `202` body; an email is queued only for the existing one containing a link with a token.
32. Reset token: stored hashed, expires in 30 min (after expiry `/auth/reset-password` -> 400 `RESET_TOKEN_INVALID`), single use (second use -> 400), requesting a new token invalidates the previous.
33. `POST /auth/reset-password` with weak password -> 422; with valid -> 204, all sessions revoked, lock reset, "password changed" email sent, old password no longer works, new one does.
34. Forgot-password throttle: 4th request within an hour for the same email -> 429.
35. `POST /auth/change-password` with wrong current password -> 401; with reuse of one of last 5 passwords -> 422; success -> 204, other sessions revoked, current session continues (fresh cookies).
36. `mustChangePassword=true` user: any `/admin/*` call -> 403 `PASSWORD_CHANGE_REQUIRED` until password changed.
37. 2FA setup -> enable with valid TOTP -> 10 recovery codes returned once; DB stores only hashes; `totpSecretEnc` is encrypted (not base32 plaintext).
38. With 2FA enabled, login returns `TOTP_REQUIRED` and no cookies; `POST /auth/login/totp` with valid code -> cookies set; invalid code -> 401 and lockout counter increments; reused TOTP code within same 30 s step -> 401; recovery code works once then fails.
39. `2fa/disable` requires password + code; after disabling, login is single-step again.
40. With `REQUIRE_2FA=true`, admin routes return 403 `TWO_FA_SETUP_REQUIRED` until enabled.
41. CSRF: an authenticated `POST /admin/products` without `X-CSRF-Token` -> 403 `CSRF_INVALID`; with mismatched token -> 403; with matching token and allowed Origin -> success.
42. Origin check: authenticated unsafe request with `Origin: https://evil.example` -> 403; with no Origin/Referer -> 403 `ORIGIN_REQUIRED`.
43. Every `/admin/*` route (sample all controllers) returns 401 without cookie; all `/public/*` GET return 200/404 without cookie.
44. Argon2 params: stored hash encodes `m=65536,t=3,p=1` (or env overrides); a changed param triggers silent rehash on next login.
45. Audit log contains LOGIN, LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET, SESSION_REVOKE, TWO_FA_ENABLE/DISABLE entries with ip/userAgent/requestId and no secrets.
46. Logs never contain cookie values, passwords or tokens (grep test on captured logs from the auth e2e suite).

### C. Public site bootstrap, settings, navigation, contact info
47. `GET /public/site` -> 200 with: siteName "Barathon Trading", logo media (seeded from `logo.png`), headerCta label "Let's Talk", search placeholder "Search Products...", footerBlurb, copyright with the current year resolved, footerCredit rendering to "Developed by Dagim Meseret", social links (hidden ones excluded), 3 phone channels and the email, head office address "Bole Road, Wollo Sefer / P.O.Box 62716 / Addis Ababa, Ethiopia", menus for HEADER/FOOTER_QUICK/FOOTER_PRODUCTS.
48. HEADER menu order is Home, About Us, Products, Service, Contact Us; Products item contains the published products (max `config.limit`) as children with working `href`s `/products/{slug}`.
49. FOOTER_PRODUCTS contains exactly the first 5 products by `sortOrder`.
50. Admin `PUT /admin/menus/HEADER/items` reorders/hides an item; the change appears in `/public/site` within 5 s; nesting depth 3 -> 422.
51. Admin changes `footerCredit.name`; public site reflects; response never contains the text "xyberlabs" anywhere in seeded data (grep over `GET /public/*` responses).
52. Admin `PATCH /admin/settings/header` sets CTA href `tel:+251911514558` (`hrefType: TEL`) -> public reflects.
53. SocialLink cannot be set `visible=true` without a URL (422); with URL it appears in `/public/site` ordered by `sortOrder`.
54. ContactChannel create/reorder/hide works and public output preserves order and excludes hidden.
55. Office with `mapEmbedUrl` host not in allow-list -> 422.
56. `GET /public/ui-strings` returns defaults for keys never overridden (e.g. `contact.submit` = "Send Message"); admin override changes the value; deleting the override restores the default.
57. Announcement bar with `endsAt` in the past is omitted from `/public/site`.
58. Maintenance flag is exposed but public API continues to respond.
59. Settings update with invalid hex color -> 422; with `expectedVersion` stale -> 409 `VERSION_CONFLICT`.
60. Settings revision list shows an entry per save; restoring a revision reverts values and creates a new revision.

### D. Pages and homepage composition
61. `GET /public/pages/home` returns blocks in order: HERO_CAROUSEL, BRANDS_MARQUEE, IMAGE_TEXT, VIDEOS_GRID, SERVICES_GRID, each with `resolved` data (8 slides from featured products, 9 brands, 8 videos with embed URLs, 2 services).
62. Setting a block `visible=false` removes it from public output; reordering via `PATCH /admin/pages/:id/blocks/reorder` changes order.
63. Creating a block with invalid `data` (e.g. `HERO_CAROUSEL.autoplayMs=10`) -> 422 `BLOCK_INVALID` with zod issue paths; unknown extra key -> 422.
64. `GET /admin/block-types` returns all 21 block types with JSON Schema and default data.
65. `GET /public/pages/about` returns `tabNav` equal to [CEO Message, Philosophy, Baraton Trade LLC, Baraton Trade PLC] in that order, blocks LEADER_MESSAGE, TIMELINE, MISSION_VISION, SUBSIDIARIES resolved.
66. CEO message text equals the source text (typos fixed) and `name`/`photo` are null until set; setting photo and name in admin shows in public response.
67. Mission has exactly 4 published items; Vision text equals source; VALUE items (DRAFT) are not in public output until published.
68. Timeline returns 4 entries in order (2007, 2007 - 2024, 2019, Today).
69. System pages cannot be deleted (409 `SYSTEM_RESOURCE_PROTECTED`) and their slug cannot be changed.
70. Creating custom page "Privacy Policy" with RICH_TEXT block, publishing it: `GET /public/pages/privacy-policy` 200; before publishing 404; reserved slug `admin` -> 409 `SLUG_RESERVED`.
71. Rich text containing `<script>alert(1)</script><img src=x onerror=alert(1)>` is stored sanitized (no script, no `onerror`) and the response contains none of those strings.
72. Page SEO fields (title, description, OG image, canonical, noindex) saved and returned in `seo`; `noindex=true` yields `robots: "noindex,follow"` (`noindex,nofollow` when `nofollow` is also set) and the page is excluded from sitemap.
73. A block referencing an unpublished product silently omits it from `resolved` and admin read shows a `warnings` item.
74. Scheduling a page for 2 minutes ahead: invisible before, visible after the job runs (<= 1 min delay), `publishedAt` equals scheduled time.

### E. Catalogue: products, categories, brands, services, videos
75. `GET /public/products` -> 8 products, default sort by `sortOrder` (FURUKAWA Rock Drills first), `meta.total=8`, `facets` present; cards contain image variants/srcset when images were imported.
76. `GET /public/products/furukawa-rock-drills` -> 200 with `contentHtml` (HTML, no leading duplicate H1), brand link, category, `seo` with canonical `https://<site>/products/furukawa-rock-drills`, `jsonLd` containing a `Product` and `BreadcrumbList`.
77. `GET /public/products/unknown` -> 404 `NOT_FOUND`.
78. Filters: `?category=filtration` returns only Elsasser; `?brand=montabert` only Montabert; `?country=JP` returns Furukawa, Air Compressor, Nakayama; `?q=compressor` returns Air Compressor first; `?featured=true` returns 8; invalid `pageSize=1000` -> 422.
79. `GET /public/products/search?q=mont` returns Montabert (prefix); `q=a` -> 400; `q=carmix` returns Carmix; accent/case-insensitive (`q=MONTABERT`); 61st request in a minute -> 429.
80. Searching a word that exists only in `contentHtml` (e.g. "earthquake" from Nakayama) finds Nakayama crushers (weight C).
81. Typo tolerance: `q=montabrt` returns Montabert via trigram.
82. Create product via admin with only `title` + `shortDescription` -> 201, status DRAFT, slug auto-generated, not visible publicly; publish -> visible; unpublish -> 404 publicly.
83. Duplicate title creates unique slug with `-2` suffix; explicit duplicate slug -> 409 `SLUG_TAKEN`.
84. Changing a published product's slug creates an automatic 301 redirect from `/products/old` to `/products/new` (visible in `/public/redirects` and `/public/redirects/resolve?path=/products/old`).
85. Product gallery `PUT /admin/products/:id/images` orders respected in public detail; referencing a deleted media -> 422.
86. Specs and documents: `PUT .../specs` and `.../documents` appear in public detail; document download endpoint returns 302 and increments `downloadCount`; only PDF media accepted (image media -> 422).
87. Related products: manual list honored; when none, automatic related (same category/brand, max 4) returned and never includes itself.
88. Soft delete: `DELETE /admin/products/:id` removes from public and list; `GET /admin/products?deleted=true` shows it; `restore` brings it back as previous status; `purge` only works on trashed items.
89. Reorder: `PATCH /admin/products/reorder` with full id list changes public order; with missing/extra id -> 422.
90. Optimistic concurrency: two PATCHes with the same `expectedVersion` -> second gets 409.
91. Revisions: each update creates a revision; `GET .../revisions` lists them; restoring revision N restores fields and creates a new revision.
92. Brands: `GET /public/brands` returns 9 brands in seeded order; `kind=PRINCIPAL` returns Furukawa and AIRMAN only; `GET /public/brands/montabert` includes description paragraphs as HTML, video (embed URL `https://www.youtube-nocookie.com/embed/tW0_L_POXeM`), country FR, related products.
93. Brand "Walter Gerätebau" has no video (invalid source link `a` skipped) and seed report lists it.
94. Brand names in seed are cleaned (`Sumitomo Construction Machinery Co., Ltd.`), and the Sumitomo short description no longer contains "is was".
95. Services: `GET /public/services` -> 2 services with features (5 and 4); feature titles like "Drill Bits"; "Predictive Maintenance" spelled correctly (no "redictive").
96. Videos: `GET /public/videos?featured=true` -> 8 items; each has `youtubeId`, `embedUrl`, `thumbnailUrl`, `startSeconds` (35 for Nakayama, 11 for Sumitomo); creating a video with URL `https://youtu.be/dQw4w9WgXcQ?t=42` stores id + start 42; `https://example.com/x` -> 422 `INVALID_YOUTUBE_URL`.
97. Category CRUD: seeded 8 categories; deleting a category with products sets those products' category to null (not cascade) and returns 200/204.
98. Missing images (failed downloads) do not break any public endpoint (`image: null`) and appear in `/admin/dashboard.warnings.missingImages`.
99. Seeded `legacyId` redirects: `GET /public/redirects/resolve?path=/product/67e8f5735d8bb94eec4cdf33` -> match to `/products/furukawa-rock-drills` type MOVED_301.

### F. Editorial, testimonials, FAQ, subsidiaries, leadership
100. Posts: create, schedule, publish; `GET /public/posts` sorted by `-publishedAt`; scheduled posts hidden until time; category/tag filters work; `GET /public/posts/:slug` includes prev/next.
101. Post `readingMinutes` computed from body (200 wpm).
102. FAQ groups: public output ordered; `seo.jsonLd` for FAQ page includes `FAQPage` when FAQ block rendered (via `GET /public/faqs`, field `jsonLd`).
103. Testimonials CRUD; rating outside 1..5 -> 422; hidden ones excluded publicly.
104. Subsidiaries: `GET /public/subsidiaries` returns LLC and PLC with lists and `partnerBrands` (Furukawa, AIRMAN) and the intro texts matching source.
105. Only one primary LeaderMessage: setting another `isPrimary=true` unsets the previous atomically; two concurrent requests never leave two or zero primaries.
106. Stats/timeline/core-values/hero-slides: CRUD + reorder + visibility + (hero slide) schedule window (`startsAt` in future hides it).

### G. Media (MinIO)
107. Upload JPEG 3000x2000 via `POST /admin/media` -> 201; response has `url`, `width`, `height`, `blurhash`, `dominantColor`, `variants` with at least `w320.webp`, `w640.webp`, `thumb.webp` immediately; `processingStatus` becomes READY and larger variants + avif appear within 30 s.
108. Object keys follow `media/{yyyy}/{mm}/{mediaId}/v1/...`; original filename does not appear in image keys.
109. Variants never exceed original width (upload 500 px image -> no w640+).
110. EXIF GPS data absent in stored original and variants.
111. Uploading `.exe` renamed `.jpg` -> 415; PNG with `.jpg` extension -> 415 (mismatch); 13 MB image -> 413; 26 MB PDF -> 413; 9000x9000 px image -> 422/413 limit error; corrupt image -> 422.
112. SVG with `<script>` and `onload=` is accepted only after sanitization: stored file contains neither; SVG with external `xlink:href` stripped.
113. PDF containing `/JavaScript` -> 415 (rejected); normal PDF accepted as DOCUMENT; public PDF served inline URL under `/media/...`; `PRIVATE` PDF not accessible via `/media/...` (403/404 from MinIO) but downloadable via `GET /admin/media/:id/download` with auth.
114. Anonymous request to MinIO `private-docs` object -> denied; listing `public-media` bucket anonymously -> denied (no ListBucket).
115. Bulk upload of 3 files with one invalid -> HTTP 207 with per-file results.
116. `PATCH /admin/media/:id` updates alt/caption/focal point; entities referencing it show alt in public DTO (`alt`), `null` when unset.
117. Media in use: `DELETE` -> 409 `MEDIA_IN_USE` listing usage; with `?force=true` -> 204 and FKs nulled; unused media delete removes objects from MinIO (verify keys gone).
118. Replace file `PUT /admin/media/:id/file` -> new `v2` key path, old objects removed, same `id`, URL changes; kind mismatch -> 422.
119. Duplicate upload (same sha256) is accepted and response lists `duplicates`.
120. Media usage index: after setting a product hero image and embedding that image in `contentHtml`, `GET /admin/media/:id` lists both usages; removing them clears usage.
121. `GET /admin/media?unused=true` lists unreferenced media older than threshold.
122. Failure injection: stop MinIO during upload -> 5xx/`503` and no `Media` row persisted; DB failure after object write -> object deleted (compensation).
123. Public media responses (via proxy) carry `Cache-Control: public, max-age=31536000, immutable`.

### H. Contact form and inbox
124. `POST /public/contact` valid body -> 201 `{id, reference}` with `reference` matching `^BT-\d{6}-[0-9A-Z]{4}$`; message stored `NEW`; notification email queued to configured recipient with `Reply-To` sender; email body HTML-escapes message.
125. Missing/invalid fields -> 422 with per-field `details`; message < 10 chars -> 422; phone with letters -> 422; extra fields -> 422.
126. Honeypot `website` filled -> 201 but nothing stored (DB count unchanged), no email.
127. Submission < 3 s after `formStartedAt` -> stored as SPAM, no email, still 201.
128. Rate limit: 6th submission within an hour from same IP -> 429; 4th within an hour with same email -> 429.
129. Captcha enabled and missing/invalid token -> 403 `CAPTCHA_FAILED`; valid token -> 201; provider timeout -> accepted with spam score +3 (logged).
130. Spam scoring: message with 3 URLs and spam phrase -> stored with status SPAM and reasons; not counted in unread count.
131. `productSlug` of a real product stores `productId` + snapshot title; unknown slug is ignored.
132. HTML in name/message (`<b>x</b><script>`) is stripped to text; admin API returns plain text; CSV export neutralizes leading `=`.
133. Email failure (SMTP down) does not fail submission; `notificationStatus` ends `FAILED` after retries and the message remains in inbox.
134. Admin inbox: list filter by status/starred/q; counts per status in `meta.counts`; opening a NEW message sets READ; status/star changes audited; `unread-count` matches.
135. Reply: `POST /admin/messages/:id/reply` queues an email to the sender, adds a REPLY note, status REPLIED, `repliedAt` set.
136. Notes add/delete; bulk actions (`archive`, `spam`, `delete`) affect only listed ids and return `affected`.
137. Mark spam / not spam toggles status and list membership.
138. CSV export returns `text/csv`, UTF-8 BOM, honours filters.
139. Message IPs older than 90 days are truncated to /24 by job (test with time travel).

### I. SEO, redirects, sitemap, robots
140. Each public detail/page response has `seo.title` using the template `"%s | Barathon Trading"` unless an explicit `metaTitle` is set (explicit used verbatim with template only if configured), `canonical` absolute, `openGraph.image` falls back to entity image then site default.
141. `jsonLd` generated: home has `Organization` (name, logo, contactPoint phones, address) + `WebSite`; product has `Product` (+ `brand`) and `BreadcrumbList`; post has `Article`; override `jsonLd` replaces generated; override missing `@context` schema.org -> 422; override > 16 KB -> 422.
142. `noindex` on an entity sets `robots` and excludes it from `/public/sitemap`.
143. `GET /public/sitemap` contains home, about, products index, all 8 product URLs, 9 brand URLs, 2 service URLs, contact; draft/trashed entities absent; `lastmod` = `updatedAt`; XML variant is valid XML and < 50k URLs.
144. `GET /public/robots.txt` includes `Disallow: /admin`, `Disallow: /api`, `Sitemap:` line; with `siteNoindex=true` returns `Disallow: /`.
145. Redirect CRUD: create `/old` -> `/about` 301; `resolve` returns it; creating `/a` -> `/b` and `/b` -> `/a` -> 409 `REDIRECT_LOOP`; target `//evil.com` or `javascript:` -> 422; absolute URL on non-allowed host -> 422.
146. Redirect import dry-run reports per-row errors without writing; non-dry-run writes valid rows; export CSV round-trips.
147. `POST /admin/redirects/test` shows chain `/a -> /b -> /c`.
148. `/public/slugs/products` returns all 8 slugs with `updatedAt`; unknown type -> 404.

### J. Revalidation, caching, jobs
149. Publishing a product triggers exactly one signed POST to `WEB_REVALIDATE_URL` within ~3 s containing tags `products`, `product:{slug}`, `sitemap` (and `page:home` if referenced); signature = HMAC-SHA256 of raw body with `REVALIDATE_SECRET`; rapid 5 edits within 2 s coalesce into one call.
150. Webhook target down: job retries with backoff (5 attempts), `RevalidationLog` records FAILED; admin save still succeeds.
151. `POST /admin/revalidate {scope:'ALL'}` -> 202 and a log entry.
152. Public GET returns `ETag`; repeat with `If-None-Match` -> 304; response `Cache-Control` has `s-maxage=60, stale-while-revalidate=300`; admin/auth responses `no-store`.
153. In-process cache invalidation: after admin update, next public GET (no waiting) reflects the change.
154. `publish-scheduled` job idempotent when two instances/ticks overlap (single publish, one audit entry).
155. Jobs survive restart: queued email persists across API restart and is delivered.
156. `purge-trash` removes items trashed > 30 d and their child rows; `purge-audit` removes logs > 365 d; expired tokens purged.

### K. Admin dashboard, audit, import/export, preview
157. `GET /admin/dashboard` returns counts consistent with DB, `messages.new`, `recentActivity` (<= 10), `upcomingScheduled`, `health`, `warnings.missingImages` (lists entities without image).
158. Every admin create/update/delete/publish/reorder/restore writes an `AuditLog` row with actor, entity, summary and field-level `diff` (no secrets); `GET /admin/audit-logs` filters by action/entity/date and paginates.
159. Audit diff for rich-text fields is truncated to 500 chars per side.
160. Export: `GET /admin/export` returns bundle `version:1` with settings, pages+blocks, products (+children), brands, services, videos, posts, menus, etc.; does not include users, password hashes, messages, tokens.
161. Import dry-run of the exported bundle on an empty DB reports `created` counts equal to exported counts and writes nothing; apply (`dryRun=false&confirm=IMPORT`) recreates content; re-import is idempotent (updated/skipped, no duplicates); invalid entity in bundle -> listed in `errors[]` and nothing applied when `mode` strict.
162. Preview token: `POST /admin/preview` for a DRAFT product -> token; `GET /public/preview/PRODUCT/:id?token=` returns the draft with `no-store`; expired/invalid token -> 401; token for a different id -> 403.
163. Trash listing `GET /admin/trash` aggregates all entity types; `POST /admin/trash/purge` requires `confirm=PURGE`.
164. `POST /admin/system/test-email` sends via SMTP transport (captured in test) and is throttled.

### L. Seed and data quality
165. `seed` on empty DB creates: 8 products, 8 categories, 9 brands, 8 videos, 2 services (9 features), 2 subsidiaries, 4 timeline entries, 4 mission items, 1 leader message, 4 contact channels, 1 office (+1 hidden), 4 social links (hidden), 3 menus populated, home and about pages, UI strings; second run creates nothing new (idempotent).
166. Seed does not overwrite an admin-edited row (edit a product title, rerun seed -> title unchanged).
167. Typo cleanup: no seeded text contains `Bussiness`, `FURKAWA`, `redictive`, `has resented`, `is was formed`, `Geratebou`; `seed-report.json` lists each fix with before/after.
168. Country normalisation: Monark country `SE`/Sweden/Ockelbo; Furukawa brand JP/Tokyo; AIRMAN JP/Saitama.
169. Markdown conversion: Nakayama product content (5.6 KB) renders headings/lists/bold as sanitized HTML; `**Carmix**` becomes `<strong>`.
170. `seed:assets` with Cloudinary unreachable completes with exit code 0, report lists failures, entities have null images; with reachable host all images become Media with variants; a non-allow-listed host in the manifest is refused.
171. `cli seed` with `ADMIN_BOOTSTRAP_*` and no users creates one admin with `mustChangePassword=true`; with an existing user it creates none.

### M. Security regression
172. SQL injection probes (`q=' OR 1=1--`, `sort=title;drop table`, `category=%27`) never error 500 and never alter results; invalid `sort` field -> 422.
173. Stored XSS probes in every text/HTML field of every admin DTO come back escaped/sanitized (plain-text fields stored literally but flagged for escaping; HTML fields sanitized).
174. SSRF: no endpoint accepts a URL that the server fetches (code review checklist + test that `mapEmbedUrl`, `youtube url`, `websiteUrl`, `redirect target` are never requested by the API — verified by network-deny test environment).
175. IDOR: all IDs are UUIDv7; admin session of user A cannot delete session of user B (404).
176. Mass assignment: sending `role`, `id`, `passwordHash`, `deletedAt`, `status` (where not allowed) in DTOs is rejected by `forbidNonWhitelisted`.
177. Rate limit headers (`Retry-After`) present on 429s; limits keyed by real client IP behind proxy (`X-Forwarded-For`) not by proxy IP.
178. File upload polyglot (GIF/JS) is re-encoded so stored file is a valid image only; PDF with embedded JS rejected.
179. Cookies in production (`COOKIE_SECURE=true`) use `__Host-`/`__Secure-` prefixes, no `Domain`, `Secure` flag set.
180. `npm audit`/`pnpm audit --prod` shows no high/critical advisories at release.
181. Container runs as non-root and root filesystem is read-only; Postgres/MinIO ports are not reachable from outside the compose network (port scan from outside shows only 80/443/22).

### N. Operations
182. Backup job produces a restorable `pg_dump` (verified by the weekly restore check writing `LAST_RESTORE_CHECK=OK`) and mirrors both buckets; killing the backup mid-run leaves previous backups intact.
183. Restore drill: dropping the DB and restoring the latest dump + MinIO mirror yields identical product/brand counts and working images.
184. `prisma migrate deploy` on an empty DB succeeds; running twice is a no-op; schema drift check (`migrate diff`) is clean in CI.
185. Compose `up` from scratch on a fresh VPS (documented steps) results in healthy `api`, `web`, `postgres`, `minio`, `proxy` and HTTPS certificate issued.
186. `GET /media/...` through the proxy serves a public image; `/minio` console is not reachable from the internet.
187. Performance smoke (k6): public GET set p95 < 250 ms, search p95 < 150 ms, error rate < 0.5 % under 50 VUs.

---

# 10. Implementation work breakdown and API contract summary

## 10.1 Schema deltas referenced elsewhere in this document (MUST be in the Prisma schema)

| Table | Addition |
|-------|----------|
| `User` | `totpLastStep Int?`, `pepperVersion Int @default(1)` |
| `PasswordHistory` | `id`, `userId FK cascade`, `hash text`, `createdAt`; keep last 5 per user |
| `Brand`, `Product` etc. | media FK columns are named `<field>MediaId` and must be listed in `MEDIA_REFERENCES` for usage tracking |
| `MediaRef` | as defined in 3.6 |
| `ContactMessage` | `reference`, `notificationStatus` as defined in 3.12 |
Every content table listed in 3.10-3.12 with `deletedAt` participates in the soft-delete extension.

## 10.2 Phases and milestones

Each phase ends with a demoable state, passing tests for that phase, and updated OpenAPI snapshot. Estimates are for one implementer.

| Phase | Name | Deliverable | Depends on | Est. |
|-------|------|-------------|------------|------|
| 0 | Foundations | pnpm monorepo wiring, `apps/api` Nest skeleton, config/env validation, Prisma + first migration (extensions), PrismaService + soft-delete extension, pino, global filters/pipes, health endpoints, Swagger, Dockerfile, dev compose (postgres, minio, mailpit), CI pipeline, `packages/contracts` scaffold | - | 3 d |
| 1 | Auth | Auth module complete (4): login, refresh rotation, logout, sessions, CSRF/Origin guards, lockout, forgot/reset/change password, mail module + templates, CLI `admin:*`, audit module basic, throttling, 2FA (can be last in phase) | 0 | 6 d |
| 2 | Storage and media | MinioService, bucket init, media upload pipeline (sharp, SVG/PDF handling, variants job via pg-boss), media admin API, folders, MediaRef/usage, orphan job | 0,1 | 6 d |
| 3 | Core CMS plumbing | `common` DTOs, slug service, sanitizer, SeoMeta service, revisions, events -> revalidation + cache tags, jobs module, publish-scheduled job, status workflow helpers, generic admin CRUD base classes | 1,2 | 5 d |
| 4 | Site-level content | Settings, UI strings, contact info (channels/offices/social), menus (incl. dynamic items), redirects, public `/site`, `/ui-strings`, `/menus`, `/redirects*` | 3 | 5 d |
| 5 | Catalogue | Categories, brands, products (+images/specs/documents/related), services, videos (YouTube parser), public catalogue endpoints, search (FTS migration + service), facets | 3,4 | 8 d |
| 6 | Pages and homepage | Page + PageBlock, zod block schemas in contracts, block resolvers, hero slides, stats, timeline, core values, leader messages, team, subsidiaries, public `/pages/:slug`, tabNav, `/admin/block-types` | 4,5 | 8 d |
| 7 | Editorial and extras | Posts/categories/tags, testimonials, FAQs, sitemap/robots/slugs endpoints, JSON-LD generation, preview tokens | 5,6 | 5 d |
| 8 | Contact pipeline | Public submit, honeypot/time-trap/captcha/spam scoring, messages inbox admin API, reply email, CSV export, retention jobs | 1,3 | 4 d |
| 9 | Seed and migration of legacy content | `seed` + `seed:assets`, typo-fix engine, markdown conversion, legacy redirects, seed report, seed e2e test | 4-8 | 4 d |
| 10 | Dashboard, audit UI API, import/export, trash, system | `/admin/dashboard`, audit query API, export/import, trash endpoints, system info/test-email | 3-9 | 4 d |
| 11 | Hardening and ops | Security review pass (checklist M), rate-limit tuning, metrics, Compose prod files, Caddyfile, backup container + restore drill, docs/runbooks, k6 smoke, final OpenAPI snapshot | all | 5 d |
| 12 (later) | Amharic i18n | translation tables, locale param support, UiString am, sitemap alternates | 11 | 6 d |

Frontend integration checkpoints: after Phase 4 (site bootstrap + menus), after Phase 5 (catalogue), after Phase 6 (home/about), after Phase 8 (contact), and Phase 1 for admin login. Backend publishes the OpenAPI snapshot at each checkpoint.

## 10.3 Task list (ordered; each task is independently verifiable; IDs are referenced in PRs)

### Phase 0
- T0.1 Create `apps/api` with Nest 11, TS strict, ESLint/Prettier, path aliases (`@/`).
- T0.2 Implement `config` module: zod `EnvSchema` from 8.5, `*_FILE` secret loading, production sanity checks.
- T0.3 Prisma init, enums (3.2), `User`..`AuthSession` tables, migration 0001 with extensions (`pgcrypto, citext, pg_trgm, unaccent`).
- T0.4 `PrismaService` with soft-delete client extension + tests.
- T0.5 Global `AllExceptionsFilter` implementing 6.1.4; request-id middleware; pino logger with redaction.
- T0.6 Global `ValidationPipe`, versioning, `helmet`, `cookie-parser`, CORS config, `trust proxy`.
- T0.7 `HealthModule` (live/ready), Swagger setup + openapi snapshot script.
- T0.8 Dockerfile (multi-stage), `deploy/compose.dev.yml` (postgres, minio, minio-init, mailpit), `README` run steps.
- T0.9 CI workflow: install, lint, typecheck, unit, integration (Testcontainers), e2e, build.
- T0.10 `packages/contracts` scaffold exporting enums (`ContentStatus`, `BlockType`, ...) used by the API.

### Phase 1
- T1.1 `CryptoService` (AES-GCM), `PasswordService` (argon2id+pepper, policy, zxcvbn, HIBP), unit tests.
- T1.2 `TokenService` (JWT sign/verify, opaque token gen/hash), cookie helper (`CookieNames`, set/clear with prod prefixes).
- T1.3 `LocalStrategy`, `JwtStrategy`, `RefreshStrategy`, `TotpChallengeStrategy` + guards, `@Public`, `@CurrentUser`, `RolesGuard`, global guard order.
- T1.4 `SessionService`, `AuthService` login/refresh/logout/logout-all with rotation + reuse detection (4.3.3) + tests for race/reuse.
- T1.5 `LockoutService` + audit events; throttler named configs (4.5).
- T1.6 `CsrfGuard` + `OriginGuard` + `CsrfService`.
- T1.7 `MailModule` (nodemailer transport, Handlebars templates: `password-reset`, `password-changed`, `new-login`, `contact-notification`, `contact-auto-reply`, `message-reply`, `test`, with text versions), `EmailLog`, pg-boss `send-email` job.
- T1.8 Password reset flow + change password + password history.
- T1.9 Sessions list/revoke endpoints; `GET /auth/me`; `mustChangePassword` and `REQUIRE_2FA` guards.
- T1.10 TOTP 2FA endpoints + recovery codes.
- T1.11 CLI (`nest-commander`): `admin:create`, `admin:list`, `admin:reset-password`, `admin:unlock`, `admin:2fa-disable`.
- T1.12 `AuditModule` (service + interceptor + `@Audit`) and `GET /admin/audit-logs`.
- T1.13 Auth e2e suite covering checklist B.

### Phase 2
- T2.1 `MinioService` + `ensureBuckets` + policy; integration test with Testcontainers MinIO.
- T2.2 `Media`, `MediaVariant`, `MediaFolder`, `MediaRef` schema + migration.
- T2.3 Upload endpoint (multer memory), sniffing (`file-type`), validation matrix (5.4), SVG sanitizer, PDF scanner.
- T2.4 `ImageProcessor` (sharp pipeline 5.5), blurhash/dominant/LQIP, sync + async variants via `image-variants` job.
- T2.5 Media admin CRUD (list/search/filters, patch, replace, delete with usage, bulk, folders, regenerate, download).
- T2.6 `MediaUsageService` + `MEDIA_REFERENCES` + HTML scanner for `/media/` URLs; `media-orphans` job.
- T2.7 Public `MediaDto` serializer (absolute URLs, srcset strings, alt semantics).
- T2.8 Media e2e + failure-injection tests (checklist G).

### Phase 3
- T3.1 `SlugService` (generate, reserved list, uniqueness, history->redirect hook).
- T3.2 `HtmlSanitizer` + `@RichText()` DTO decorator + tests with XSS corpus.
- T3.3 `SeoMeta` model/service (`upsertFor`, `resolve`, JSON-LD builders: Organization, WebSite, Product, BreadcrumbList, Article, FAQPage), `SeoMetaDto` validation.
- T3.4 `RevisionsService` + `ContentRevision`; generic `snapshot/restore` contract per resource.
- T3.5 Domain events + `RevalidationService` (debounce, HMAC webhook, retries, log) + `revalidation-map.ts` + admin revalidate endpoints.
- T3.6 `CacheService` (LRU + tags) + `ResponseCacheInterceptor` + ETag/Cache-Control interceptor for public controllers.
- T3.7 Base abstractions: `BaseAdminService<T>` (CRUD, soft delete, restore, purge, status transitions, reorder, optimistic concurrency, warnings), shared DTOs (`PaginationQueryDto`, `ReorderDto`, `ScheduleDto`, `BulkActionDto`).
- T3.8 `publish-scheduled`, `purge-trash`, `purge-audit`, `purge-expired-tokens` jobs.
- T3.9 Preview module (sign/verify tokens, admin + public endpoints).

### Phase 4
- T4.1 `SiteSettings` + zod sub-schemas + admin GET/PUT/PATCH group endpoints + revisions + seed defaults.
- T4.2 `UiString` + defaults file + admin bulk upsert + public merged map.
- T4.3 `ContactChannel`, `Office` (map host allow-list), `SocialLink` modules.
- T4.4 `Menu`/`MenuItem` modules, tree validation, dynamic item expansion (`DYNAMIC_PRODUCTS` etc. through read services/interfaces to avoid circular deps; implemented via a `MenuItemResolver` registry that catalogue modules register into).
- T4.5 `Redirect` module (normalisation, loop detection, resolve, CSV import/export, auto redirects on slug change, hit counters sampled).
- T4.6 `GET /public/site` aggregator + cache tags `site`.

### Phase 5
- T5.1 `ProductCategory`, `Brand` modules (admin + public).
- T5.2 `Product` + children replace endpoints; public list/detail/facets; related logic.
- T5.3 FTS migration (3.11), `SearchService`, `/public/products/search`, `/public/search`.
- T5.4 `Service` + `ServiceFeature`; `Video` + `YoutubeParser` (formats: watch, embed, youtu.be, shorts, `t=`/`start=`; nocookie embed URL building).
- T5.5 Public DTO projections (`ProductCardDto`, ...), JSON-LD for products.
- T5.6 e2e suites E.

### Phase 6
- T6.1 Block zod schemas in `packages/contracts` + `GET /admin/block-types` (zod -> JSON Schema via `zod-to-json-schema`).
- T6.2 `Page`/`PageBlock` modules, blocks CRUD/reorder/replace, `by-key`, protection of system pages.
- T6.3 `BlockResolverRegistry` + 21 resolvers; unresolved-reference warnings.
- T6.4 `HeroSlide`, `Stat`, `TimelineEntry`, `CoreValue`, `LeaderMessage`, `TeamMember`, `Subsidiary` modules (+ public endpoints where listed).
- T6.5 `tabNav` builder; public `/pages/:slug`; page SEO/JSON-LD; sitemap integration.
- T6.6 e2e suites D, F.

### Phase 7
- T7.1 Posts/categories/tags (reading time, prev/next, related); public endpoints.
- T7.2 Testimonials, FAQ groups + FAQs (nested admin routes).
- T7.3 `SitemapService`, `RobotsService`, `/public/slugs/:type`.
- T7.4 SEO preview endpoint `GET /admin/seo-preview`.

### Phase 8
- T8.1 `ContactMessage` schema; public submit pipeline (7.2), `SpamService`, `CaptchaService`.
- T8.2 Admin messages API (6.3.8), notes, reply email, bulk, CSV export, unread count.
- T8.3 Jobs: `contact-notification` email, IP truncation, optional message retention.
- T8.4 e2e suite H.

### Phase 9
- T9.1 Seed framework (idempotent upserts by natural key, report writer).
- T9.2 Text cleanup engine (`typo-fixes.json`), country normaliser, Markdown converter, YouTube link normaliser.
- T9.3 Seed data files (3.13.3) and mapping code for products/brands/services/videos.
- T9.4 `seed:assets` downloader (host allow-list, retries, manifest) using the media pipeline.
- T9.5 Legacy redirects generation.
- T9.6 Seed e2e (checklist L).

### Phase 10
- T10.1 Dashboard service/endpoint (6.3.2).
- T10.2 Export/import services (bundle schema versioned, dry-run, confirm token).
- T10.3 Trash aggregation + purge endpoints; system info/test-email.

### Phase 11
- T11.1 Run full security checklist M; fix findings; ZAP baseline.
- T11.2 `deploy/compose.yml`, `compose.prod.yml`, `Caddyfile`, `minio-init`, backup image + scripts + restore drill + `README-ops.md`.
- T11.3 Metrics + Sentry wiring, log review.
- T11.4 k6 smoke script; tune indexes/cache.
- T11.5 Freeze OpenAPI snapshot, tag release `v1.0.0`.

## 10.4 Definition of done (per task)
Code merged with: unit/integration/e2e tests for the new behaviour, OpenAPI decorators present, DTO validation decorators complete, audit + revision + event wiring (for content), no lint/type errors, migrations included, relevant checklist items verified, and docs of any new env var added to `.env.example` and 8.5.

## 10.5 API contract summary (TypeScript-style DTOs the frontend can rely on)

Shared types are exported from `packages/contracts`. Fields marked `| null` are always present (explicit null); optional (`?`) fields may be absent. All `*Html` strings are already sanitized and safe to inject with `dangerouslySetInnerHTML` inside a typography container.

```ts
// ---------- primitives ----------
type UUID = string; type ISODate = string;
type ContentStatus = 'DRAFT'|'SCHEDULED'|'PUBLISHED'|'ARCHIVED';
interface Paginated<T> { data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }
interface ApiError { statusCode: number; code: string; message: string; details?: { field: string; message: string; code?: string }[]; requestId: string; timestamp: ISODate; path: string }

// ---------- media ----------
interface MediaVariantDto { label: string; format: 'webp'|'avif'|'jpeg'|'png'; width: number; height: number; url: string }
interface MediaDto {
  id: UUID; kind: 'IMAGE'|'SVG'|'ICON'|'DOCUMENT';
  url: string;                       // original (absolute)
  alt: string | null; caption: string | null;
  width: number | null; height: number | null;
  blurhash: string | null; dominantColor: string | null; lqip: string | null;
  focal: { x: number; y: number } | null;
  variants: MediaVariantDto[];
  srcset: { webp: string; avif: string | null };   // ready-to-use srcset strings
  mimeType: string; sizeBytes: number;
}

// ---------- seo ----------
interface SeoDto { /* see 6.2.0 */ }
interface SeoMetaInput {
  metaTitle?: string | null; metaDescription?: string | null;
  ogTitle?: string | null; ogDescription?: string | null; ogImageId?: UUID | null;
  twitterCard?: 'SUMMARY'|'SUMMARY_LARGE_IMAGE';
  canonicalUrl?: string | null; noindex?: boolean; nofollow?: boolean; keywords?: string | null;
  jsonLd?: object | object[] | null;
}

// ---------- site bootstrap ----------
interface SiteDto {
  siteName: string; legalName: string | null; tagline: string | null; locale: 'en';
  logoLight: MediaDto | null; logoDark: MediaDto | null; favicon: MediaDto | null; appleTouchIcon: MediaDto | null; defaultOgImage: MediaDto | null;
  brandColors: { primary: string; accent: string; themeColor: string };
  headerCta: { enabled: boolean; label: string; hrefType: 'PATH'|'TEL'|'MAILTO'|'URL'; href: string; icon: 'phone'|'arrow'|'none' };
  search: { enabled: boolean; placeholder: string };
  footer: { blurb: string | null; copyright: string /* {year} resolved */; credit: { enabled: boolean; prefix: string; name: string; url: string | null } };
  announcement: { text: string; linkLabel: string | null; href: string | null; variant: 'INFO'|'WARNING'|'PROMO' } | null;
  maintenance: { enabled: boolean; message: string | null };
  analytics: { ga4Id: string | null; gtmId: string | null; searchConsoleVerification: string | null };
  seoDefaults: { titleTemplate: string; defaultTitle: string; defaultDescription: string | null; twitterHandle: string | null; siteNoindex: boolean };
  contactForm: { consentRequired: boolean; consentText: string | null; captchaProvider: 'NONE'|'TURNSTILE'|'HCAPTCHA'; captchaSiteKey: string | null };
  social: { id: UUID; platform: 'FACEBOOK'|'X'|'LINKEDIN'|'INSTAGRAM'|'YOUTUBE'|'TELEGRAM'|'TIKTOK'|'WHATSAPP'; url: string; label: string | null; showInFooter: boolean; showOnContactPage: boolean }[];
  channels: { id: UUID; type: 'PHONE'|'EMAIL'|'WHATSAPP'|'FAX'; label: string | null; value: string; displayValue: string; href: string /* tel:/mailto: */; showOnContactPage: boolean; showInFooter: boolean; showInHeader: boolean }[];
  offices: { id: UUID; name: string; isPrimary: boolean; lines: string[] /* ready-to-print address lines */; city: string; countryName: string; latitude: number | null; longitude: number | null; mapEmbedUrl: string | null; openingHours: { days: string; open: string; close: string }[] | null }[];
  menus: Record<'HEADER'|'FOOTER_QUICK'|'FOOTER_PRODUCTS'|'FOOTER_LEGAL', MenuItemDto[]>;
  uiStrings: Record<string, string>;
}
interface MenuItemDto { id: UUID; label: string; href: string; target: 'SELF'|'BLANK'; icon: string | null; children: MenuItemDto[]; viewAll?: { label: string; href: string } }
interface MenuDto { location: string; items: MenuItemDto[] }

// ---------- pages / blocks ----------
interface PageDto {
  id: UUID; slug: string; key: 'home'|'about'|null; title: string; template: 'HOME'|'ABOUT'|'DEFAULT';
  heroTitle: string | null; heroSubtitle: string | null; heroImage: MediaDto | null;
  blocks: BlockDto[]; tabNav: { label: string; anchorId: string }[];
  updatedAt: ISODate; seo: SeoDto;
}
interface BlockBase { id: UUID; type: BlockType; anchorId: string | null; navLabel: string | null; showInTabNav: boolean; title?: string; subtitle?: string; background?: string; spacing?: string }
type BlockDto =
  | (BlockBase & { type: 'HERO_CAROUSEL'; autoplayMs: number; showThumbnails: boolean; showCounter: boolean; slides: HeroSlideDto[] })
  | (BlockBase & { type: 'BRANDS_MARQUEE'; speed: 'SLOW'|'NORMAL'|'FAST'; linkToBrand: boolean; grayscale: boolean; brands: BrandCardDto[] })
  | (BlockBase & { type: 'BRAND_GRID'; columns: number; brands: BrandCardDto[] })
  | (BlockBase & { type: 'IMAGE_TEXT'; image: MediaDto | null; imagePosition: 'LEFT'|'RIGHT'|'TOP'; heading: string | null; bodyHtml: string; buttons: { label: string; href: string; variant: 'PRIMARY'|'SECONDARY'|'LINK'; target: 'SELF'|'BLANK' }[] })
  | (BlockBase & { type: 'STATS'; stats: StatDto[] })
  | (BlockBase & { type: 'FEATURED_PRODUCTS'; layout: 'GRID'|'CAROUSEL'; products: ProductCardDto[]; viewAll?: { label: string; href: string } })
  | (BlockBase & { type: 'VIDEOS_GRID'; videos: VideoDto[] })
  | (BlockBase & { type: 'SERVICES_GRID'; services: ServiceCardDto[]; cta?: { label: string; href: string } })
  | (BlockBase & { type: 'TESTIMONIALS'; layout: 'CAROUSEL'|'GRID'; testimonials: TestimonialDto[] })
  | (BlockBase & { type: 'LATEST_POSTS'; posts: PostCardDto[] })
  | (BlockBase & { type: 'CTA_BANNER'; heading: string; text: string | null; backgroundImage: MediaDto | null; buttons: { label: string; href: string; variant: string }[] })
  | (BlockBase & { type: 'TIMELINE'; orientation: 'VERTICAL'|'HORIZONTAL'; entries: TimelineEntryDto[] })
  | (BlockBase & { type: 'LEADER_MESSAGE'; leader: LeaderMessageDto | null })
  | (BlockBase & { type: 'MISSION_VISION'; missionTitle: string; visionTitle: string; visionHtml: string; missionItems: CoreValueDto[] })
  | (BlockBase & { type: 'CORE_VALUES'; layout: 'CARDS'|'LIST'; values: CoreValueDto[] })
  | (BlockBase & { type: 'SUBSIDIARIES'; layout: 'TABS'|'STACKED'; subsidiaries: SubsidiaryDto[] })
  | (BlockBase & { type: 'TEAM'; members: TeamMemberDto[] })
  | (BlockBase & { type: 'FAQ'; groups: FaqGroupDto[] })
  | (BlockBase & { type: 'RICH_TEXT'; html: string })
  | (BlockBase & { type: 'IMAGE_GALLERY'; columns: number; images: MediaDto[] })
  | (BlockBase & { type: 'CONTACT_STRIP'; buttonLabel: string | null; buttonHref: string | null; channels: SiteDto['channels']; offices: SiteDto['offices'] });
type BlockType = 'HERO_CAROUSEL'|'BRANDS_MARQUEE'|'BRAND_GRID'|'IMAGE_TEXT'|'STATS'|'FEATURED_PRODUCTS'|'VIDEOS_GRID'|'SERVICES_GRID'|'TESTIMONIALS'|'LATEST_POSTS'|'CTA_BANNER'|'TIMELINE'|'LEADER_MESSAGE'|'MISSION_VISION'|'CORE_VALUES'|'SUBSIDIARIES'|'TEAM'|'FAQ'|'RICH_TEXT'|'IMAGE_GALLERY'|'CONTACT_STRIP';

interface HeroSlideDto { id: UUID; eyebrow: string | null; heading: string; subheading: string | null; image: MediaDto | null; mobileImage: MediaDto | null; overlayOpacity: number; buttons: { label: string; href: string }[]; href: string | null /* linked product/brand path */ }
interface StatDto { id: UUID; value: number; prefix: string | null; suffix: string | null; label: string; icon: string | null }
interface TimelineEntryDto { id: UUID; yearLabel: string; title: string; descriptionHtml: string; image: MediaDto | null; icon: string | null }
interface CoreValueDto { id: UUID; group: 'MISSION'|'VALUE'; title: string; description: string | null; icon: string | null }
interface LeaderMessageDto { id: UUID; heading: string; name: string | null; jobTitle: string | null; photo: MediaDto | null; signature: MediaDto | null; messageHtml: string }
interface TeamMemberDto { id: UUID; name: string; jobTitle: string | null; bioHtml: string | null; photo: MediaDto | null }
interface SubsidiaryDto { id: UUID; slug: string; name: string; legalName: string | null; countryCode: string; regionNote: string | null; tagline: string | null; introHtml: string; bodyHtml: string | null; lists: { title: string; style: 'BULLETS'|'CHECKS'|'CHIPS'; items: string[] }[]; partnerBrands: { brand: BrandCardDto; relation: 'OFFICIAL_AGENT'|'EXCLUSIVE_RIGHTS' }[]; logo: MediaDto | null; image: MediaDto | null; websiteUrl: string | null; anchorId: string }

// ---------- catalogue ----------
interface CountryDto { code: string | null; name: string | null; city: string | null }
interface BrandCardDto { id: UUID; slug: string; name: string; kind: 'PRINCIPAL'|'PARTNER'; shortDescription: string; logo: MediaDto | null; logoDark: MediaDto | null; country: CountryDto; href: string }
interface BrandDto extends BrandCardDto { descriptionHtml: string; heroImage: MediaDto | null; websiteUrl: string | null; videos: VideoDto[]; products: ProductCardDto[]; seo: SeoDto }
interface CategoryDto { id: UUID; slug: string; name: string; description: string | null; image: MediaDto | null; parentSlug: string | null; productCount: number; children?: CategoryDto[]; seo?: SeoDto }
interface ProductCardDto { id: UUID; slug: string; title: string; shortDescription: string; image: MediaDto | null; brand: { slug: string; name: string; logo: MediaDto | null } | null; category: { slug: string; name: string } | null; country: CountryDto; isFeatured: boolean; href: string }
interface ProductDto extends ProductCardDto {
  contentHtml: string; tagline: string | null; partNumber: string | null; inquiryEnabled: boolean;
  gallery: { id: UUID; media: MediaDto; caption: string | null }[];
  specs: { groupName: string | null; label: string; value: string; unit: string | null }[];
  documents: { id: UUID; title: string; language: 'EN'|'AM'; sizeBytes: number; downloadUrl: string }[];
  related: ProductCardDto[]; videos: VideoDto[]; publishedAt: ISODate; updatedAt: ISODate; seo: SeoDto;
}
interface ProductSearchHitDto { id: UUID; slug: string; title: string; shortDescription: string; image: MediaDto | null; brand: { slug: string; name: string } | null; href: string }
interface ProductListResponse extends Paginated<ProductCardDto> { facets: { categories: { slug: string; name: string; count: number }[]; brands: { slug: string; name: string; count: number }[]; countries: { code: string; name: string; count: number }[] } }
interface ServiceCardDto { id: UUID; slug: string; title: string; shortDescription: string; image: MediaDto | null; iconName: string | null; features: { title: string; description: string | null }[]; href: string }
interface ServiceDto extends ServiceCardDto { bodyHtml: string | null; ctaLabel: string | null; ctaHref: string | null; seo: SeoDto }
interface VideoDto { id: UUID; title: string; description: string | null; youtubeId: string; startSeconds: number | null; embedUrl: string; thumbnailUrl: string; thumbnail: MediaDto | null; brand: { slug: string; name: string } | null; isFeatured: boolean }

// ---------- editorial ----------
interface PostCardDto { id: UUID; slug: string; title: string; excerpt: string; cover: MediaDto | null; category: { slug: string; name: string } | null; authorName: string | null; publishedAt: ISODate; readingMinutes: number; href: string }
interface PostDto extends PostCardDto { bodyHtml: string; tags: { slug: string; name: string }[]; prev: PostCardDto | null; next: PostCardDto | null; related: PostCardDto[]; updatedAt: ISODate; seo: SeoDto }
interface TestimonialDto { id: UUID; quote: string; personName: string; personRole: string | null; companyName: string | null; photo: MediaDto | null; rating: number | null }
interface FaqGroupDto { id: UUID; slug: string; title: string; items: { id: UUID; question: string; answerHtml: string }[]; jsonLd: object }

// ---------- contact ----------
interface SubmitContactResponse { id: UUID | null; reference: string | null; message: string }

// ---------- misc public ----------
interface RedirectRule { source: string; target: string; type: 'MOVED_301'|'FOUND_302'|'TEMP_307'|'PERM_308'; match: 'EXACT'|'PREFIX' }
interface SitemapEntry { loc: string; lastmod: ISODate; changefreq: 'daily'|'weekly'|'monthly'|'yearly'; priority: number; images?: string[] }

// ---------- auth / admin ----------
interface MeDto { id: UUID; email: string; name: string; role: 'ADMIN'; avatar: MediaDto | null; mustChangePassword: boolean; twoFactorEnabled: boolean; csrfToken: string }
interface SessionDto { id: UUID; deviceLabel: string | null; ip: string | null; createdAt: ISODate; lastUsedAt: ISODate; current: boolean }
interface MessageListItemDto { id: UUID; reference: string; name: string; email: string; phone: string | null; excerpt: string; status: 'NEW'|'READ'|'REPLIED'|'ARCHIVED'|'SPAM'; isStarred: boolean; productTitle: string | null; createdAt: ISODate }
interface MessageDto extends Omit<MessageListItemDto,'excerpt'> { message: string; subject: string | null; sourcePath: string | null; ip: string | null; userAgent: string | null; spamScore: number; spamReasons: string[]; notificationStatus: 'PENDING'|'SENT'|'FAILED'; notes: { id: UUID; kind: 'NOTE'|'REPLY'; body: string; author: { id: UUID; name: string } | null; createdAt: ISODate }[]; readAt: ISODate | null; repliedAt: ISODate | null }

// ---------- admin base shapes ----------
interface AdminBase { id: UUID; status?: ContentStatus; publishedAt?: ISODate | null; scheduledAt?: ISODate | null; sortOrder?: number; version: number; createdAt: ISODate; updatedAt: ISODate; deletedAt: ISODate | null; warnings: { code: string; message: string; field?: string }[] }
interface RevisionDto { id: UUID; versionNo: number; changeNote: string | null; author: { id: UUID; name: string } | null; createdAt: ISODate }
interface AuditLogDto { id: string; action: string; entityType: string | null; entityId: string | null; summary: string; diff: Record<string, [unknown, unknown]> | null; actorEmail: string | null; ip: string | null; createdAt: ISODate }
```
Admin entity DTOs (`ProductAdminDto`, `BrandAdminDto`, ...) = `AdminBase` + all editable fields from 3.x tables with media fields expanded as `MediaDto` objects in responses and accepted as `<field>MediaId: UUID | null` in inputs, + `seo: SeoMetaInput & { id }`. Inputs are the `Create<X>Input`/`Update<X>Input` shapes listed in 6.3; every `Update` is `Partial` of `Create` plus `expectedVersion?: number`.

## 10.6 Contract rules for the frontend

1. Frontend consumes absolute media URLs and never builds media URLs itself.
2. Every public list is already filtered to published content; the frontend never filters by status.
3. All user-visible strings that are not content come from `SiteDto.uiStrings` (key catalogue 6.5).
4. Navigation, footer, contact info, social links, header CTA, credit line come ONLY from `GET /public/site`.
5. Internal links in DTOs are provided as `href` path strings (e.g. `/products/montabert`); the frontend must not derive paths from slugs with its own templates (single source: `ROUTES` in `packages/contracts`).
6. On 404 with `redirect` body or via `/public/redirects`, the frontend redirects; the middleware fetches `/public/redirects` (tag `redirects`) and caches it.
7. The frontend revalidation route verifies the HMAC signature as specified in 6.1.7 and calls `revalidateTag` for each tag.
8. Admin UI obtains block editor schemas from `GET /admin/block-types`, never hard-codes block fields.
9. Admin UI reads `csrfToken` from `/auth/me` (or cookie `bt_csrf`) and sends `X-CSRF-Token` on every non-GET request; implements single-flight refresh on 401 `TOKEN_EXPIRED` (call `/auth/refresh` once, retry the original request once).
10. Footer credit must be rendered as `"{prefix} {name}"` (default "Developed by Dagim Meseret") and copyright as provided.

## 10.7 Open questions for the product owner (do not block implementation; defaults in brackets)

1. Which admin emails should exist at launch, and which recipient(s) get contact notifications? [one admin from CLI; recipient from `CONTACT_NOTIFY_TO`]
2. Real social profile URLs? [hidden until supplied]
3. CEO name and portrait? [empty until supplied]
4. Is a Florida address available for the Baraton Trade LLC office? [hidden placeholder]
5. Should brochures be offered as public downloads? [yes, PUBLIC visibility default]
6. Captcha provider choice (Turnstile recommended)? [NONE until keys supplied; honeypot + rate limit active]
7. Should the "Products" dropdown show all products or categories? [products, max 12, switchable to categories via `DYNAMIC_PRODUCTS` config]
8. Domain names for production and for staging (noindex)? [env-driven]
