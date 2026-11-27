# Barathon Trading API (`apps/api`)

NestJS 11 REST API for the Barathon Trading site and admin CMS. PostgreSQL 16 through Prisma 6,
MinIO (S3 API) for files, Passport.js (local, JWT and refresh strategies) for authentication,
argon2id for password hashing, sharp for images.

Base URL: `/api/v1`. Public read endpoints live under `/api/v1/public`, admin endpoints under
`/api/v1/admin`, identity endpoints under `/api/v1/auth`.

## Prerequisites

- Node.js 22 and pnpm 10 (monorepo root: `pnpm install`)
- PostgreSQL 16
- MinIO (or any S3-compatible server) for uploads and media. The API starts without it, but
  `/health/ready` reports 503 and uploads fail with `503 STORAGE_UNAVAILABLE`.

## Setup and run

```bash
cp apps/api/.env.example apps/api/.env        # then edit the secrets
pnpm --filter api db:migrate                  # = prisma migrate deploy (also run by the Docker entrypoint)
pnpm --filter api build
pnpm --filter api start                       # node dist/main.js on PORT (default 4000)
pnpm --filter api start:dev                   # tsx watch, for development
```

Useful endpoints once running: `GET /api/v1/health/live`, `GET /api/v1/health/ready`,
Swagger UI at `/api/docs` (when `SWAGGER_ENABLED=true`), OpenAPI JSON at `/api/v1/openapi.json`.

## Commands (`node dist/cli.js <command>`, or `pnpm --filter api <script>`)

| Command | Purpose |
|---------|---------|
| `admin:create --email you@x.com --name "Name" [--password-stdin]` | Creates the first (or another) administrator. The password is read from stdin or prompted, and must pass the policy (12+ characters, zxcvbn score 3+, no email name). |
| `admin:reset-password --email you@x.com` | Resets the account to the constant from `ADMIN_RESET_PASSWORD`, forces a password change and revokes all sessions. |
| `admin:unlock --email you@x.com` | Clears a lockout immediately. |
| `admin:list` | Lists accounts with their lock and change-password flags. |
| `seed` | Imports the legacy content from `docs/source` (idempotent, see below). Writes `apps/api/seed-report.json`. |
| `seed:assets` | Downloads the legacy images from allow-listed hosts and stores them in MinIO. Failures are recorded in the report and the command still exits 0. |
| `db:check` | Row counts for the main tables. |

Bootstrap without the CLI: set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`, then run
`seed`. The account is created only when no user exists, with `mustChangePassword=true`. Remove
both variables after the first start.

## Environment variables

All variables are validated at boot (zod). Missing or invalid values stop the process with a list
of problems. In `NODE_ENV=production` the process also refuses placeholder secrets
(`change-me`, `placeholder`, `example.com`), `COOKIE_SECURE=false` and `ALLOW_BEARER=true`.
The full list with comments is in `.env.example`. The important ones:

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_ACCESS_SECRET`, `PASSWORD_PEPPER` | At least 32 characters. Rotating the pepper invalidates existing password hashes. |
| `ADMIN_RESET_PASSWORD` | The constant that forgot-password resets to. At least 12 characters. See below. |
| `ALLOWED_ORIGINS` | Exact origins allowed by CORS and by the CSRF origin check. |
| `COOKIE_SECURE` | `true` in production. Enables the `__Host-bt_at` and `__Secure-` cookie prefixes. |
| `MINIO_*`, `MINIO_BUCKET_PUBLIC`, `MINIO_BUCKET_PRIVATE` | Object storage. Buckets and the anonymous-read policy for `media/*` are created at boot. |
| `PUBLIC_MEDIA_BASE_URL` | Public base for media URLs (the proxy maps `/media/*` to the public bucket). |
| `MAX_IMAGE_UPLOAD_MB`, `MAX_VIDEO_UPLOAD_MB` (200), `MAX_DOCUMENT_UPLOAD_MB` | Upload limits per kind. |
| `FFMPEG_PATH` | Optional. Enables video duration and automatic poster frames. |
| `WEB_REVALIDATE_URL`, `REVALIDATE_SECRET` | Revalidation webhook to the Next.js app. Empty values disable it. |
| `RATE_LIMITS_ENABLED` | `false` disables throttling (tests only). |
| `CAPTCHA_PROVIDER`, `CAPTCHA_SECRET` | Optional captcha for the contact form. |

There are no SMTP or email variables. The API sends no email.

## Authentication, forgot password and forced change

- `POST /auth/login` sets three cookies: `bt_at` (access JWT, HttpOnly, 15 minutes), `bt_rt`
  (opaque refresh token, HttpOnly, SameSite=Strict, scoped to `/api/v1/auth`) and `bt_csrf`
  (readable by the frontend). No token is returned in the body.
- Refresh rotates the token. Reusing a rotated token within 10 seconds returns `REFRESH_RACE`.
  Reusing it later revokes the whole session (`REFRESH_REUSE`) and writes an audit entry.
- Every unsafe request under `/admin` and `/auth` needs `X-CSRF-Token` equal to the `bt_csrf`
  cookie, and an `Origin` (or `Referer`) from `ALLOWED_ORIGINS`.
- Five consecutive wrong passwords lock the account (15 minutes, doubling, capped at 24 hours).
  A locked account answers `423 ACCOUNT_LOCKED`. `admin:unlock` clears the lock.

**Forgot password is a constant reset, not an email flow.** `POST /auth/forgot-password`
with `{ "identifier": "<admin email>" }` always returns the same 200 message:
"If the account exists, its password was reset to the default password. Sign in and you will be
asked to choose a new one." When the account exists, its password is set to the value of
`ADMIN_RESET_PASSWORD`, all sessions are revoked, and `mustChangePassword` is set. Limits: 3 requests
per hour per IP and 5 per hour overall.

While `mustChangePassword` is set, every `/admin` route returns `403 PASSWORD_CHANGE_REQUIRED`.
`GET /auth/me`, `POST /auth/change-password` and `POST /auth/logout` stay available. The change
needs only `newPassword` (and optionally `confirmPassword`). It must meet the policy and must differ
from `ADMIN_RESET_PASSWORD`. A normal change also needs `currentPassword` and rejects the last
five passwords.

**Keep `ADMIN_RESET_PASSWORD` secret.** Anyone who knows it can sign in and reset the admin
password to it. Rotate it by changing the environment variable and restarting the API. Existing
passwords are not affected until a reset happens.

Two-factor authentication is not implemented in this build. The `totpSecretEnc`, `totpEnabledAt`
and `totpLastStep` columns exist so it can be added later without a migration.

## Content model and endpoints

Every resource is documented in `docs/plan/backend-plan.md`. Summary:

- Public: `/public/site`, `/public/ui-strings`, `/public/menus[/:location]`, `/public/pages[/:slug]`
  (`home`, `about` and custom pages with resolved blocks and `tabNav`), `/public/products`
  (filters, facets, `/search`, `/:slug`, document download), `/public/product-categories`,
  `/public/brands`, `/public/services`, `/public/videos` (`/:id`, `/:id/stream`),
  `/public/subsidiaries`, `/public/posts`, `/public/testimonials`, `/public/faqs`,
  `/public/search`, `/public/contact` (POST), `/public/redirects[/resolve]`, `/public/sitemap`,
  `/public/sitemap.xml`, `/public/robots.txt`, `/public/slugs/:type`.
- Frontend-plan aliases: `/public/settings`, `/public/navigation`, `/public/home`, `/public/about`,
  `/public/contact` (channels, offices and form settings), `/public/faq`, `/public/robots`,
  `/public/search/suggest`, `/public/contact-messages` (POST).
- Admin: `/admin/{products,brands,product-categories,services,videos,pages,posts,subsidiaries,
  testimonials,faq-groups,media,media-folders,settings,ui-strings,menus,redirects,messages,
  contact-channels,offices,social-links,audit-logs,dashboard,block-types}`. Publishable resources
  share the same routes: list, create, read, patch, soft delete, `restore`, `purge`, `publish`,
  `unpublish`, `archive`, `schedule`, `reorder`, `bulk` and `revisions`.

Errors use one envelope: `{ statusCode, code, message, details?, requestId, timestamp, path }`.
Validation failures are 422 `VALIDATION_FAILED`. Every response carries `X-Request-Id`.

## Videos (YouTube or uploaded file)

- **YouTube**: `POST /admin/videos` with `{ title, url, startSeconds? }`. Any youtube.com,
  youtu.be or youtube-nocookie.com link form is accepted (watch, short, embed, live, v). Other
  hosts return `422 INVALID_YOUTUBE_URL`. The 11-character id and the start time are stored.
  Public responses include `embedUrl` (`https://www.youtube-nocookie.com/embed/<id>`), `posterUrl`
  (the uploaded poster, or `i.ytimg.com` hqdefault), `sourceType`, `youtubeId`, `startSeconds`.
- **Upload**: `POST /admin/videos/upload` (multipart: `file` mp4 or webm up to
  `MAX_VIDEO_UPLOAD_MB`, optional `poster` image, `title`, `brandId`, `productId`, `isFeatured`).
  The file is checked by magic bytes and stored in the public bucket. Public responses include
  `mediaUrl` and `posterUrl`. `GET /public/videos/:id/stream` serves byte ranges (206, `Accept-Ranges`).
  In production the reverse proxy serves `/media/*` from MinIO, which also supports ranges.
- Videos can be linked to a brand, a product and the home page (`isFeatured`). Brand, product and
  home-grid reads all use the same DTO. Video entries with `VideoObject` JSON-LD are included in
  the sitemap for their brand page.

## Seeding the legacy content

`seed` reads `docs/source/product.json`, `company.json`, `service.json`, and the copy from
`ui-strings.txt` and the brand block, applies the typo fixes in `src/seed/data/typo-fixes.json`,
and maps countries (table in the same file). Every applied fix is written to `seed-report.json`
under `typoFixes`. The seed inserts only missing rows, so edited rows are never overwritten.
Walter Gerätebau's video link (`a`) is skipped and listed in the report. The six YouTube ids from
the brief are seeded as videos: two are linked to brands, and four appear as "Featured video N"
for the admin to retitle, because they are not present in `docs/source`.

`seed:assets` downloads the Cloudinary images (host allow-list, HTTPS only, no redirects, 12 MB
cap, timeout, 3 retries). It stores them through the media pipeline and records a manifest in
`assets-manifest.json`, so reruns skip images already stored.

## Media

Uploads are validated by magic bytes, extension and size. Raster images are re-encoded (EXIF
removed), and WebP and AVIF variants at 320, 640, 960, 1280 and 1920 px (never upscaled) are
generated, along with a 400 px thumbnail, blurhash, dominant colour and LQIP. SVG files are
sanitised (scripts, handlers, foreignObject, external references removed). PDFs with JavaScript or
launch actions are rejected. Object keys are `media/{yyyy}/{mm}/{mediaId}/v{n}/...` and never contain the
original file name. Deleting media that is still referenced returns `409 MEDIA_IN_USE` unless
`?force=true`.

## Revalidation

Changes that affect public output queue tags and paths (debounced for 2 seconds). The API POSTs
them to `WEB_REVALIDATE_URL` with `X-Revalidate-Timestamp` and
`X-Revalidate-Signature: sha256=HMAC_SHA256(REVALIDATE_SECRET, "<timestamp>.<body>")`.
The receiver should reject signatures that do not match or timestamps more than five minutes
old. Failed deliveries are retried with backoff (2 s, 10 s, 30 s, 2 min, 10 min) and recorded in
`revalidation_logs`. Admin writes never wait for the webhook.

## Scheduled publishing and retention

An in-process scheduler runs every minute. It publishes rows whose `scheduledAt` has passed,
using a guarded update so overlapping ticks publish a row once, and writes an audit entry as
`SYSTEM`. Once a day it purges trash older than `TRASH_RETENTION_DAYS` and audit rows older than
`AUDIT_RETENTION_DAYS`.

## Tests

```bash
pnpm --filter api test                        # unit tests (src/**/*.spec.ts), no database needed
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/barathon_test \
  pnpm --filter api test:e2e                  # e2e suites; applies migrations, truncates between files
```

The e2e suites use an in-memory object store in place of MinIO. They cover authentication
(login, lockout, refresh rotation, race and reuse, CSRF, origin, the constant-password reset and
forced change, logout), catalogue CRUD and slug rules, the YouTube parser, image and video
upload with range streaming, the contact pipeline, the site bootstrap and sitemap, page blocks, and
the legacy seed with idempotency.

## Docker

`apps/api/Dockerfile` builds from the repository root (`docker build -f apps/api/Dockerfile .`).
It runs as the non-root `node` user and applies migrations before starting, unless
`DB_AUTO_MIGRATE=false`. The image was not built in this environment, so it is untested.

## Known differences from the plan

- Background jobs use an in-process scheduler (not pg-boss), so jobs do not survive a restart.
  Scheduled publishing still happens within a minute of the time due.
- Schema: media references are scalar columns with SQL foreign keys, and SEO rows are keyed by
  `(entityType, entityId)` rather than a `seoId` column. Column names are camelCase.
- Soft delete is applied by a Prisma query extension that filters `deletedAt` on reads. Pass
  `deletedAt: undefined` to include trashed rows.
- Uploads are buffered in memory (multer) before storage. The 200 MB video limit is therefore
  memory-bound.
- Not implemented: email (by design), TOTP 2FA, Amharic, revision restore (revisions can be
  listed), the CSV import/export of content bundles, the `/admin/system/*` endpoints, the message
  retention job, the HIBP password check, and presigned uploads.
