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
