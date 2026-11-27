import sharp, { type Metadata } from 'sharp';
import { encode as encodeBlurhash } from 'blurhash';

export const WIDTHS = [320, 640, 960, 1280, 1920] as const;
export const MAX_PIXELS = 100_000_000;
export const MAX_SIDE = 8000;

export interface ProcessedVariant {
  label: string;
  format: 'webp' | 'avif';
  width: number;
  height: number;
  data: Buffer;
}

export interface ImageAnalysis {
  width: number;
  height: number;
  original: Buffer;
  originalFormat: 'jpeg' | 'png' | 'webp' | 'avif';
  blurhash: string | null;
  dominantColor: string | null;
  lqip: string | null;
  variants: ProcessedVariant[];
}

export class InvalidImageError extends Error {}

/** Decodes an image, strips metadata, and produces the original plus responsive variants. */
export async function processImage(input: Buffer, mimeHint: string): Promise<ImageAnalysis> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: 'error', limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new InvalidImageError('The image could not be decoded');
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new InvalidImageError('The image has no dimensions');
  if (width > MAX_SIDE || height > MAX_SIDE) throw new InvalidImageError(`Images must be at most ${MAX_SIDE}px on a side`);

  const originalFormat: ImageAnalysis['originalFormat'] =
    mimeHint === 'image/png' ? 'png' : mimeHint === 'image/webp' || mimeHint === 'image/gif' ? 'webp' : mimeHint === 'image/avif' ? 'avif' : 'jpeg';

  const base = sharp(input, { failOn: 'error', limitInputPixels: MAX_PIXELS }).rotate();
  let original: Buffer;
  if (originalFormat === 'png') original = await base.clone().png({ compressionLevel: 9 }).toBuffer();
  else if (originalFormat === 'webp') original = await base.clone().webp({ quality: 90 }).toBuffer();
  else if (originalFormat === 'avif') original = await base.clone().avif({ quality: 60, effort: 4 }).toBuffer();
  else original = await base.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer();

  const rotated = await sharp(original).metadata();
  const outW = rotated.width ?? width;
  const outH = rotated.height ?? height;

  const pixels = await sharp(original).resize(32, 32, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const blurhash = encodeBlurhash(new Uint8ClampedArray(pixels), 32, 32, 4, 3);

  const stats = await sharp(original).stats();
  const { r, g, b } = stats.dominant;
  const dominantColor = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

  const lqipBuf = await sharp(original).resize({ width: 20 }).webp({ quality: 30 }).toBuffer();
  const lqipRaw = `data:image/webp;base64,${lqipBuf.toString('base64')}`;
  const lqip = lqipRaw.length <= 1500 ? lqipRaw : null;

  const variants: ProcessedVariant[] = [];
  const targets = WIDTHS.filter((w) => w < outW);
  if (!targets.length) targets.push(outW as (typeof WIDTHS)[number]);
  for (const w of targets) {
    const resized = sharp(original).resize({ width: Math.min(w, outW), withoutEnlargement: true });
    const webp = await resized.clone().webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    variants.push({ label: `w${w}`, format: 'webp', width: webp.info.width, height: webp.info.height, data: webp.data });
    const avif = await resized.clone().avif({ quality: 55, effort: 4 }).toBuffer({ resolveWithObject: true });
    variants.push({ label: `w${w}`, format: 'avif', width: avif.info.width, height: avif.info.height, data: avif.data });
  }
  const thumb = await sharp(original).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer({ resolveWithObject: true });
  variants.push({ label: 'thumb', format: 'webp', width: thumb.info.width, height: thumb.info.height, data: thumb.data });

  return { width: outW, height: outH, original, originalFormat, blurhash, dominantColor, lqip, variants };
}

/** Reads the intrinsic size of an image without decoding its pixels. */
export async function imageSize(input: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const m = await sharp(input, { failOn: 'error', limitInputPixels: MAX_PIXELS }).metadata();
    return m.width && m.height ? { width: m.width, height: m.height } : null;
  } catch {
    return null;
  }
}
