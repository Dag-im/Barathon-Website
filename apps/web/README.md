# apps/web: Baraton Group Co. website and admin

Next.js 15 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, react-hook-form + zod, TanStack Query and Table.
Public site, SEO, and the `/admin` content screens. Talks to the NestJS API in `apps/api` over `/api/v1`.

## Run

```bash
pnpm install
cp .env.example .env.local          # then edit values
pnpm --filter web dev               # http://localhost:3000
```

Without the API running, use the dev mock layer:

```bash
NEXT_PUBLIC_USE_MOCKS=1 pnpm --filter web dev
```

The mock (`src/lib/mocks`) is built from `docs/source/*.json`. It is for development only and is
ignored in production unless `NEXT_PUBLIC_ALLOW_MOCK_PRODUCTION=1` is set, which is for local visual checks
of a production build. Never set it on a server. Admin edits in mock mode live in memory until the dev server restarts.

## Scripts

| Script | What it does |
|---|---|
| `pnpm --filter web dev` | Development server |
| `pnpm --filter web build` | Production build (type-checks and lints) |
| `pnpm --filter web start` | Serves the production build |
| `pnpm --filter web typecheck` | `tsc --noEmit` |

## Environment

See `.env.example`. Required for production: `NEXT_PUBLIC_SITE_URL`, `API_INTERNAL_URL`, `REVALIDATE_SECRET` (32+ chars,
must match the API), `PREVIEW_SECRET`, `NEXT_PUBLIC_MEDIA_BASE_URL` (the MinIO public bucket URL; it is added to the
`next/image` remote patterns at build time, so rebuild when it changes).

The API must be reachable at `API_INTERNAL_URL` while `next build` runs, because ISR pages are prerendered.

## Key decisions

- **Auth**: httpOnly cookies set by the API (`bt_at`/`bt_rt`, prefixed in production). Browser calls go through the
  same-origin `/api/v1` rewrite and send `X-CSRF-Token` from the `bt_csrf` cookie. A 401 triggers a single-flight refresh.
  Middleware gates `/admin` on cookie presence; the admin layout verifies the session with `GET /auth/me`.
  A forced password change (`mustChangePassword`) redirects to `/admin/change-password-required`.
- **Forgot password** (amendment A2): identifier only, always the same generic message. No email (amendment A1).
- **Developer credit** (amendment A4): "Developed by Dagim Meseret" is fixed in `SiteFooter` and not CMS-editable.
- **Videos** (amendment A6): `VideoPlayer` shows a poster facade and loads the `youtube-nocookie` iframe on click;
  uploads use a native `<video controls preload="metadata">`. Used by the home Featured Videos block, brand pages,
  product pages and the `[video:ID]` / `[upload:/path]` shortcodes in rich text. Video sitemap: `/video-sitemap.xml`.
  `VideoObject` JSON-LD is emitted on product and brand pages.
- **Images**: `CmsImage` renders next/image, or the ring placeholder when no media exists. Never a broken-image icon.
- **Rendering**: public pages are server components with `fetch` tags and `revalidate`. The API calls `POST /api/revalidate`
  with `X-Revalidate-Signature` (HMAC-SHA256 of the raw body) and `X-Revalidate-Timestamp`.
- **Redirects**: static legacy rules in `next.config.ts`. CMS redirects are looked up at request time in `app/not-found.tsx`
  (middleware sets `x-pathname`).
- **SEO**: Metadata API on every route, `JsonLd` per template, `sitemap.xml`, `robots.txt`, `manifest.webmanifest`,
  OG images (`opengraph-image.tsx`), filtered product lists `noindex,follow` with a canonical to `/products`.

## Known gaps

- Admin: the Tiptap editor is not used. HTML fields are plain textareas. Drag-and-drop reordering is replaced by
  up/down buttons. The navigation tree editor, revisions drawer, media upload (presigned flow), two-factor setup and
  the pages module are not built yet.
- Public: the product gallery shows the cover image only. Tabs are rendered as stacked sections (all content in the DOM).
  The Embla carousel is replaced by a CSS and state carousel. No Turnstile captcha slot yet.
- Legacy `/product/:id` and `/comapny/:id` redirect to the list pages, not to slugs (the id to slug map needs the API).
- Logo: `docs/source/logo.png` only contains the ring mark, so the wordmark in `logo-full*.svg` is live SVG text
  (Afacad Flux, falls back to Arial when the font is not installed).
- Category names and product-to-category assignments are proposed. Editors must review them.
- The six featured YouTube videos are titled "BARATON featured video N" until editors name them.

## Layout

```
src/app/(public)/...      public routes (home, about, products, brands, services, contact, news, faq, search, [slug])
src/app/admin/...         (auth) login, forgot, forced change; (dashboard) session-guarded module screens
src/app/api/...           revalidate, preview, health
src/components/           ui (shadcn), layout, sections (block renderer), media (CmsImage, VideoPlayer), admin
src/lib/api/              typed client, public fetchers (cache tags), admin calls, DTO types
src/lib/seo/              metadata mapping, JSON-LD builders, list-page metadata
src/lib/mocks/            dev-only mock API (seed from docs/source)
```
