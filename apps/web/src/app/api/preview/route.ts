import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Enables draft mode for a short-lived preview token: token = "<path>.<hmac>" where
 * hmac = HMAC_SHA256(PREVIEW_SECRET, path) in hex (issued by the API). Only relative paths are accepted.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "/";
  const token = url.searchParams.get("token") ?? "";
  const expected = env.previewSecret ? createHmac("sha256", env.previewSecret).update(path).digest("hex") : "";
  const ok = Boolean(expected) && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok || !path.startsWith("/") || path.startsWith("//")) return new Response("Invalid preview link", { status: 401 });
  (await draftMode()).enable();
  redirect(path);
}
