# syntax=docker/dockerfile:1
# Production image for the public site and admin (Next.js standalone output).
# Build context: repository root (the workspace lockfile is needed).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter web... --frozen-lockfile

FROM deps AS build
COPY apps/web apps/web
# Public variables are inlined at build time. The API must be reachable at API_INTERNAL_URL during the build
# so ISR pages can be prerendered. Mock mode must never be enabled here.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_BASE_PATH=/api/v1
ARG NEXT_PUBLIC_MEDIA_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_LOCALE=en
ARG NEXT_PUBLIC_ENABLE_INDEXING=true
ARG NEXT_PUBLIC_DEVELOPER_URL=
ARG API_INTERNAL_URL=http://api:3001
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_USE_MOCKS=0
RUN pnpm --filter web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
