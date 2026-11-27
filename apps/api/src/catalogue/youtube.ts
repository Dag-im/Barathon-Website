import { ApiError } from '../common/utils/errors';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const ID = /^[A-Za-z0-9_-]{11}$/;

export interface ParsedYouTube {
  youtubeId: string;
  startSeconds: number | null;
  sourceUrl: string;
}

/** Parses "1h2m3s", "90s", "35" into seconds. */
export function parseStart(raw: string | null): number | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^\d+$/.test(value)) return Number(value);
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !value) return null;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

/**
 * Extracts the 11-character id and start offset from any YouTube link form
 * (watch, youtu.be, shorts, embed, live, v). Other hosts are rejected.
 */
export function parseYouTube(input: string): ParsedYouTube | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host.endsWith('youtu.be')) {
    id = segments[0] ?? null;
  } else if (url.pathname === '/watch' || url.pathname.startsWith('/watch/')) {
    id = url.searchParams.get('v');
  } else if (['embed', 'shorts', 'v', 'live'].includes(segments[0] ?? '')) {
    id = segments[1] ?? null;
  }
  if (!id || !ID.test(id)) return null;

  const start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return { youtubeId: id, startSeconds: start, sourceUrl: input.trim().slice(0, 500) };
}

/** Parses or throws INVALID_YOUTUBE_URL (backend-plan 6.1.4). */
export function requireYouTube(input: string): ParsedYouTube {
  const parsed = parseYouTube(input);
  if (!parsed) throw new ApiError(422, 'INVALID_YOUTUBE_URL', 'Enter a valid YouTube link');
  return parsed;
}

export function youtubeEmbedUrl(id: string, start?: number | null): string {
  return `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`;
}

export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
