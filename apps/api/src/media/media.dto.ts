import type { Media, MediaVariant } from '@prisma/client';

export interface MediaVariantDto {
  label: string;
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  width: number;
  height: number;
  url: string;
}

export interface MediaDto {
  id: string;
  kind: 'IMAGE' | 'SVG' | 'ICON' | 'DOCUMENT' | 'VIDEO';
  url: string;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  dominantColor: string | null;
  lqip: string | null;
  focal: { x: number; y: number } | null;
  variants: MediaVariantDto[];
  srcset: { webp: string; avif: string | null };
  mimeType: string;
  sizeBytes: number;
}

export type MediaRow = Media & { variants?: MediaVariant[] };

/** Public URL for an object key under media/ (the proxy maps /media/* to the public bucket). */
export function publicMediaUrl(base: string, objectKey: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/${objectKey.replace(/^media\//, '')}`;
}

function srcsetFor(variants: MediaVariantDto[], format: 'webp' | 'avif'): string {
  return variants
    .filter((v) => v.format === format && v.label.startsWith('w'))
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ');
}

/** Shapes a media row as the public DTO (backend-plan 10.5). Only READY variants are exposed. */
export function toMediaDto(row: MediaRow, base: string, apiBase: string): MediaDto {
  const isPrivate = row.visibility === 'PRIVATE';
  const url = isPrivate ? `${apiBase}/admin/media/${row.id}/download` : publicMediaUrl(base, row.objectKey);
  const variants: MediaVariantDto[] = (row.variants ?? [])
    .filter((v) => v.objectKey)
    .map((v) => ({
      label: v.label,
      format: v.format as MediaVariantDto['format'],
      width: v.width,
      height: v.height,
      url: publicMediaUrl(base, v.objectKey),
    }));
  const focal = row.focalX !== null && row.focalY !== null ? { x: row.focalX, y: row.focalY } : null;
  return {
    id: row.id,
    kind: row.kind,
    url,
    alt: row.alt,
    caption: row.caption,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    dominantColor: row.dominantColor,
    lqip: row.lqip,
    focal,
    variants,
    srcset: { webp: srcsetFor(variants, 'webp'), avif: srcsetFor(variants, 'avif') || null },
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
  };
}
