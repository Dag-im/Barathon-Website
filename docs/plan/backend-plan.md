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
  id, platform SocialPlatform UNIQUE-per-platform? (NO - multiple allowed), url varchar(500) NULL, label varchar(60) NULL,
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
  INDEX (status, isFeatured, sortOrder), UNIQUE (youtubeId, brandId) NULLS NOT DISTINCT? -> use plain INDEX(youtubeId) (duplicates warned, not blocked)

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
  ip inet NULL (stored truncated? NO: stored full; purged to /24 after 90 days by job), userAgent varchar(400) NULL,
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
public-media/media/{yyyy}/{mm}/{mediaId}/original.{ext}
public-media/media/{yyyy}/{mm}/{mediaId}/w{width}.{webp|avif}      e.g. w640.webp, w1280.avif
public-media/media/{yyyy}/{mm}/{mediaId}/thumb.webp                  (400 px wide, used by admin library)
public-media/media/{yyyy}/{mm}/{mediaId}/{slugified-original-name}.pdf   (documents: readable name for download; id folder guarantees uniqueness)
private-docs/docs/{yyyy}/{mm}/{mediaId}/{slugified-original-name}.pdf
private-docs/exports/{iso-timestamp}-{userId}.json
```
`mediaId` is the UUID v7 of the `Media` row (so keys are unguessable and immutable; replacing a file creates a new `mediaId` folder... NO: replacing keeps `mediaId` but writes to a new versioned folder `{mediaId}/v{n}/...` and updates `objectKey`/variants, because URLs must change for cache busting; old objects are removed after success). Final: key pattern is `media/{yyyy}/{mm}/{mediaId}/v{n}/...`, `n` starts at 1.

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
