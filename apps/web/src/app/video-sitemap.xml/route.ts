import { getVideos } from "@/lib/api/public";
import { absoluteUrl } from "@/lib/seo/urls";
import { env } from "@/lib/env";
import { youtubeThumb } from "@/lib/utils/youtube";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Video sitemap (amendment A6): every published video with its player location. */
export async function GET() {
  const { data } = await getVideos({ pageSize: 48 }).catch(() => ({ data: [] }));
  const items = data
    .filter((v) => (v.sourceType === "YOUTUBE" ? v.youtubeId : v.mediaUrl))
    .map((v) => {
      const thumb = v.sourceType === "YOUTUBE" ? (v.posterUrl ?? youtubeThumb(v.youtubeId as string)) : (v.posterUrl ?? "");
      const page = v.brand ? absoluteUrl(`/brands/${v.brand.slug}`) : v.product ? absoluteUrl(`/products/${v.product.slug}`) : absoluteUrl("/");
      const loc = v.sourceType === "YOUTUBE" ? `<video:player_loc>https://www.youtube-nocookie.com/embed/${v.youtubeId}</video:player_loc>` : `<video:content_loc>${esc(absoluteUrl(v.mediaUrl as string))}</video:content_loc>`;
      return `<url><loc>${esc(page)}</loc><video:video><video:thumbnail_loc>${esc(thumb)}</video:thumbnail_loc><video:title>${esc(v.title)}</video:title><video:description>${esc(v.description ?? v.title)}</video:description>${loc}<video:publication_date>${v.updatedAt}</video:publication_date></video:video></url>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${env.enableIndexing ? items : ""}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
}
