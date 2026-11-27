# Approved amendments (these OVERRIDE backend-plan.md, frontend-plan.md and frontend-design.md)

Approved by the project owner after reviewing the plans.

## A1. No email functionality anywhere
- Do NOT use nodemailer/SMTP. Remove every SMTP env var, email template, email queue job and "send email" step.
- Contact-form messages are only stored and shown in the admin Messages inbox (unread badge in sidebar + dashboard). No notification email, no reply-by-email. The admin copies the sender's email/phone from the message.

## A2. Forgot password = reset to a constant password (no tokens, no email)
- The secret constant lives ONLY in the env var `ADMIN_RESET_PASSWORD` (min 12 chars, meets the password policy, never committed; `.env.example` holds a placeholder that the API refuses to start with when NODE_ENV=production).
- `POST /api/v1/auth/forgot-password` body `{ identifier }` (the admin's email/username). Always responds with the same generic 200 message (never reveals whether the account exists). If it matches the admin: set the password hash to `ADMIN_RESET_PASSWORD`, set `mustChangePassword = true`, revoke ALL refresh tokens/sessions, write an audit-log entry. Rate limit 3 requests/hour/IP and 5/hour global.
- Login with the constant works as normal login but the session is "restricted": every admin API except `GET /auth/me`, `POST /auth/change-password` and `POST /auth/logout` returns 403 `PASSWORD_CHANGE_REQUIRED`, and the admin UI redirects every /admin route to `/admin/change-password-required`.
- `POST /auth/change-password` on a restricted session needs only the new password (+ confirmation) and must: satisfy the password policy, differ from `ADMIN_RESET_PASSWORD`, clear `mustChangePassword`, rotate the session. A normal (non-restricted) change still requires the current password.
- REMOVE: reset tokens table/endpoints (`/auth/reset-password/:token`), the `/reset-password/[token]` page, token emails. The forgot-password page only has the identifier field and shows the generic message plus the text "If the account exists, its password was reset to the default password. Sign in and you will be asked to choose a new one."
- Also keep a CLI command `pnpm --filter api admin:reset-password` doing the same reset, and `admin:create` for first-admin bootstrap.
- Document in the README that the constant must be kept secret and rotated by editing the env var.

## A3. Scope trims for the first build (to be done later, not now)
- No TOTP 2FA, no Amharic/i18n, no scheduled publishing, no revisions-restore UI beyond a simple list if time allows. Keep DB columns where already planned, but do not build the UI/logic for 2FA.

## A4. Footer credit
- Footer says "Developed by Dagim Meseret" (hard-coded, no link to xyberlabs anywhere).

## A5. Git rules
- Never mention Claude/AI/assistant in code, comments, docs, commit messages or package metadata. Do not run git commit/push yourself; the orchestrator commits.

## A6. Videos: uploaded file OR YouTube link, both played inside the website
- A Video entity has `sourceType`: `UPLOAD` or `YOUTUBE`.
  - `YOUTUBE`: admin pastes any YouTube URL (watch, youtu.be, shorts, embed, with extra params like `&t=35s`). The API validates and extracts the 11-char video id, stores `youtubeId` (+ optional start seconds) and derives the thumbnail (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`, admin may override with an uploaded poster). Reject non-YouTube hosts (SSRF/XSS safe).
  - `UPLOAD`: admin uploads mp4/webm (max 200 MB, configurable) to the MinIO public-media bucket via the media pipeline; store the media id, duration if known, and a poster image (uploaded or generated frame via ffmpeg if available, otherwise a placeholder). Serve with HTTP range support (Accept-Ranges) via the reverse proxy / API stream route.
- Public playback stays on the site: YouTube plays in an in-page player using the privacy-friendly `youtube-nocookie.com/embed/<id>` iframe loaded only after click (facade, per the design); uploads play in a native `<video controls preload="metadata" poster=...>` inside the same player dialog/section. No link-outs to youtube.com as the default behaviour.
- Applies everywhere videos appear: the home "Featured Videos" section, brand/company detail video (replaces the free-text company youtube link; seed it as a YOUTUBE video linked to the brand), product detail videos, and the News/page rich-text video block.
- Admin Videos module: form with a source toggle (YouTube link / Upload file), live preview, title, description, poster, linked product/brand, order, published flag. Seed the six live YouTube ids found in docs/source/ui-strings.txt / the old bundle (AJSPVh_fCoY, C8uXNLChKuo, gnwQx7AC2ws, pyoNPfUgJJo, q9M_eFAnwPs, uQlNhObyLu8) plus the brand links in docs/source/company.json (skip invalid values like "a").
- Add `VideoObject` JSON-LD and include videos in the video sitemap/sitemap entries.
