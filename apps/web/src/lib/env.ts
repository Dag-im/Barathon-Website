/**
 * Validated environment access. Public vars are inlined at build time by Next.
 * Missing optional values fall back to safe defaults; required server values
 * are checked lazily so `next build` does not need a running API.
 */
const trimSlash = (value: string) => value.replace(/\/+$/, "");

export const env = {
  siteUrl: trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE_PATH ?? "/api/v1",
  apiInternalUrl: trimSlash(process.env.API_INTERNAL_URL ?? "http://localhost:3001"),
  mediaBaseUrl: trimSlash(process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? ""),
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en",
  enableIndexing: (process.env.NEXT_PUBLIC_ENABLE_INDEXING ?? "true") !== "false",
  developerUrl: process.env.NEXT_PUBLIC_DEVELOPER_URL ?? "",
  revalidateSecret: process.env.REVALIDATE_SECRET ?? "",
  previewSecret: process.env.PREVIEW_SECRET ?? "",
} as const;

/**
 * Mock API switch. Dev-only: active under `next dev` when NEXT_PUBLIC_USE_MOCKS=1.
 * A production build uses mocks only when NEXT_PUBLIC_ALLOW_MOCK_PRODUCTION=1 is also set, which is
 * a local visual-verification escape hatch. Never set it in Docker or on a server.
 */
export const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === "1" &&
  (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ALLOW_MOCK_PRODUCTION === "1");
