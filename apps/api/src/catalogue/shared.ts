import { MediaDto } from '../media/media.dto';

export interface CountryDto {
  code: string | null;
  name: string | null;
  city: string | null;
}

export function country(code: string | null, name: string | null, city: string | null = null): CountryDto {
  return { code, name, city };
}

export function trimText(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

export function mediaOf(map: Map<string, MediaDto>, id: string | null | undefined): MediaDto | null {
  return id ? map.get(id) ?? null : null;
}

/** Builds JSON-LD for a video (backend-plan A6): VideoObject with the on-site player URL. */
export function videoObjectJsonLd(v: {
  title: string;
  description: string | null;
  posterUrl: string | null;
  sourceType: string;
  embedUrl: string | null;
  mediaUrl: string | null;
  publishedAt: string | null;
  siteUrl: string;
}): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.title,
    description: v.description ?? v.title,
    thumbnailUrl: v.posterUrl ? [v.posterUrl] : undefined,
    uploadDate: v.publishedAt ?? undefined,
  };
  if (v.sourceType === 'YOUTUBE' && v.embedUrl) jsonLd.embedUrl = v.embedUrl;
  if (v.sourceType === 'UPLOAD' && v.mediaUrl) jsonLd.contentUrl = v.mediaUrl;
  return Object.fromEntries(Object.entries(jsonLd).filter(([, val]) => val !== undefined));
}
