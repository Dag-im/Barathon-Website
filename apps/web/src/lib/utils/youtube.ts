/**
 * Extracts an 11-character YouTube id from the URL variants found in the
 * source data: watch?v=, youtu.be/, embed/, shorts/, live/, with extra params
 * such as &t=35s or ?si=. Returns null for anything else (e.g. the value "a").
 */
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

export function parseYoutube(input: string | null | undefined): { youtubeId: string; startSeconds: number | null } | null {
  if (!input) return null;
  const raw = input.trim();
  if (ID.test(raw)) return { youtubeId: raw, startSeconds: null };
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  let id: string | null = null;
  if (url.hostname.includes("youtu.be")) {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
    id = m?.[2] ?? null;
  }
  if (!id || !ID.test(id)) return null;
  return { youtubeId: id, startSeconds: parseStart(url) };
}

function parseStart(url: URL): number | null {
  const t = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (!t) return null;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return /^\d+$/.test(t) ? Number(t) : null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbed = (id: string, start?: number | null, autoplay = true) => {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (autoplay) params.set("autoplay", "1");
  if (start) params.set("start", String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
};
