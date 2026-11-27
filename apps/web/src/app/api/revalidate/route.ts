import { revalidatePath, revalidateTag } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * On-demand revalidation from the API (backend 6.1.7). Verifies
 * X-Revalidate-Signature = sha256=HMAC(REVALIDATE_SECRET, rawBody) and rejects
 * timestamps more than five minutes away.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-revalidate-signature") ?? "";
  const ts = Number(req.headers.get("x-revalidate-timestamp") ?? "0");
  if (!env.revalidateSecret || !sig.startsWith("sha256=")) return Response.json({ error: "unauthorised" }, { status: 401 });
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return Response.json({ error: "stale" }, { status: 401 });
  const expected = createHmac("sha256", env.revalidateSecret).update(raw).digest("hex");
  const given = sig.slice("sha256=".length);
  const ok = given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return Response.json({ error: "unauthorised" }, { status: 401 });
  let body: { tags?: string[]; paths?: string[] };
  try {
    body = JSON.parse(raw) as { tags?: string[]; paths?: string[] };
  } catch {
    return Response.json({ error: "malformed" }, { status: 400 });
  }
  for (const t of body.tags ?? []) revalidateTag(t);
  for (const p of body.paths ?? []) revalidatePath(p);
  return Response.json({ revalidated: true, now: Date.now() });
}
