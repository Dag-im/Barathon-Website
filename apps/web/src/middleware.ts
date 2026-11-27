import { NextResponse, type NextRequest } from "next/server";

const ACCESS = ["bt_at", "__Host-bt_at", "bt_rt", "__Secure-bt_rt"];
const PUBLIC_ADMIN = ["/admin/login", "/admin/forgot-password"];
const MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1" && (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ALLOW_MOCK_PRODUCTION === "1");

/**
 * Edge middleware (plan 4.7):
 * - sets x-pathname for the CMS redirect lookup in not-found.tsx;
 * - gates /admin on the presence of a session cookie (validity is checked by the layout);
 * - normalises public paths (lowercase, no trailing slash) with a 301;
 * - adds X-Robots-Tag on admin and when indexing is disabled.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const indexing = (process.env.NEXT_PUBLIC_ENABLE_INDEXING ?? "true") !== "false";

  if (pathname.startsWith("/admin")) {
    const isPublicAdmin = PUBLIC_ADMIN.some((p) => pathname === p);
    const hasSession = ACCESS.some((c) => req.cookies.has(c));
    if (!isPublicAdmin && !hasSession && !MOCKS) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      const res = NextResponse.redirect(url, 307);
      res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return res;
    }
    if (isPublicAdmin && hasSession && !MOCKS) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
  } else {
    const lower = pathname.toLowerCase();
    const trimmed = lower.length > 1 ? lower.replace(/\/+$/, "") : lower;
    if (trimmed !== pathname && !pathname.startsWith("/_next") && !pathname.startsWith("/api")) {
      const url = req.nextUrl.clone();
      url.pathname = trimmed || "/";
      return NextResponse.redirect(url, 301);
    }
  }

  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  const res = NextResponse.next({ request: { headers } });
  if (pathname.startsWith("/admin") || !indexing) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|placeholders/|mock/|.*\\.(?:svg|png|jpg|jpeg|webp|avif|mp4|woff2?)$).*)"],
};
