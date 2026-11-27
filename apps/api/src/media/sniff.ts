import { MediaKind } from '@prisma/client';

export interface Sniffed {
  mime: string;
  kind: MediaKind;
  extensions: string[];
  /** Absent for SVG, which is text and is checked separately. */
  isSvg?: boolean;
}

const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString('latin1');

/** Detects the real file type from magic bytes; the client MIME type is never trusted. */
export function sniff(buf: Buffer): Sniffed | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', kind: MediaKind.IMAGE, extensions: ['jpg', 'jpeg'] };
  }
  if (buf[0] === 0x89 && ascii(buf, 1, 4) === 'PNG') {
    return { mime: 'image/png', kind: MediaKind.IMAGE, extensions: ['png'] };
  }
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') {
    return { mime: 'image/webp', kind: MediaKind.IMAGE, extensions: ['webp'] };
  }
  if (ascii(buf, 0, 3) === 'GIF') {
    return { mime: 'image/gif', kind: MediaKind.IMAGE, extensions: ['gif'] };
  }
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) {
    return { mime: 'image/x-icon', kind: MediaKind.ICON, extensions: ['ico'] };
  }
  if (ascii(buf, 0, 5) === '%PDF-') {
    return { mime: 'application/pdf', kind: MediaKind.DOCUMENT, extensions: ['pdf'] };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mime: 'video/webm', kind: MediaKind.VIDEO, extensions: ['webm'] };
  }
  if (ascii(buf, 4, 8) === 'ftyp') {
    const brand = ascii(buf, 8, 12);
    if (brand === 'avif' || brand === 'avis') {
      return { mime: 'image/avif', kind: MediaKind.IMAGE, extensions: ['avif'] };
    }
    if (['isom', 'iso2', 'iso5', 'mp41', 'mp42', 'M4V ', 'M4VP', 'avc1', 'dash'].includes(brand)) {
      return { mime: 'video/mp4', kind: MediaKind.VIDEO, extensions: ['mp4', 'm4v'] };
    }
    return null;
  }
  const head = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return { mime: 'image/svg+xml', kind: MediaKind.SVG, extensions: ['svg'], isSvg: true };
  }
  return null;
}

/** Lower-cased extension without dot, or '' when absent. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}
