import { env, USE_MOCKS } from "@/lib/env";
import { CSRF_COOKIES } from "@/lib/constants";
import { ApiError, toApiError } from "./errors";

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** Next.js fetch cache options (server only). */
  next?: { tags?: string[]; revalidate?: number | false };
  cache?: RequestCache;
  /** Forwarded cookie header for server-side admin calls. */
  cookie?: string;
  /** Skip the automatic refresh-on-401 (used by auth endpoints themselves). */
  noRefresh?: boolean;
}

const isServer = typeof window === "undefined";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(names: readonly string[]): string | null {
  if (isServer) return null;
  for (const name of names) {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    if (hit) return decodeURIComponent(hit.slice(name.length + 1));
  }
  return null;
}

function buildPath(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Single-flight refresh shared by all concurrent 401 responses in the browser. */
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const csrf = readCookie(CSRF_COOKIES) ?? "";
        const res = await fetch(`${env.apiBasePath}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": csrf, "Content-Type": "application/json" },
          body: "{}",
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

/**
 * Typed request helper used by server components (public site, through
 * `next.fetch` tags) and by client components (admin, via TanStack Query).
 * Browser calls go to the same-origin `/api/v1` path rewritten by next.config.
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (USE_MOCKS) {
    const { mockRequest } = await import("@/lib/mocks/handler");
    return mockRequest<T>(opts.method ?? "GET", path, opts.query, opts.body);
  }

  const method = opts.method ?? "GET";
  const base = isServer ? `${env.apiInternalUrl}${env.apiBasePath}` : env.apiBasePath;
  const url = `${base}${buildPath(path, opts.query)}`;

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (UNSAFE.has(method) && !isServer) headers["X-CSRF-Token"] = readCookie(CSRF_COOKIES) ?? "";
    if (opts.cookie) headers.cookie = opts.cookie;
    const init: RequestInit & { next?: { tags?: string[]; revalidate?: number | false } } = {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: "include",
    };
    if (isServer) {
      if (opts.next) init.next = opts.next;
      if (opts.cache) init.cache = opts.cache;
      else if (opts.cookie) init.cache = "no-store";
    } else {
      init.cache = "no-store";
    }
    return fetch(url, init);
  };

  let res = await send();
  if (res.status === 401 && !isServer && !opts.noRefresh && !path.startsWith("/auth/")) {
    if (await refreshSession()) res = await send();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { ApiError };
