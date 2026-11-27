/**
 * Conservative SVG sanitiser: removes scripts, event handlers, foreignObject, DTDs and any
 * external reference. Returns the cleaned markup and the intrinsic size when it can be read.
 */
export function sanitizeSvg(input: string): { svg: string; width: number | null; height: number | null } {
  let svg = input
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<(iframe|embed|object|audio|video|style|link|meta)[\s\S]*?(<\/\1\s*>|\/>)/gi, '');
  svg = svg.replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  svg = svg.replace(/\s((?:xlink:)?href)\s*=\s*("([^"]*)"|'([^']*)')/gi, (match, _attr, _q, dq, sq) => {
    const value = (dq ?? sq ?? '').trim();
    return value.startsWith('#') ? match : '';
  });
  svg = svg.replace(/javascript:/gi, '');
  if (!/^\s*<svg[\s>]/i.test(svg.replace(/^\s+/, '')) && !/<svg[\s>]/i.test(svg)) {
    return { svg: '', width: null, height: null };
  }
  const open = svg.match(/<svg[^>]*>/i)?.[0] ?? '';
  const viewBox = open.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const w = open.match(/\swidth\s*=\s*["']([\d.]+)/i);
  const h = open.match(/\sheight\s*=\s*["']([\d.]+)/i);
  const width = w ? Math.round(Number(w[1])) : viewBox ? Math.round(Number(viewBox[1])) : null;
  const height = h ? Math.round(Number(h[1])) : viewBox ? Math.round(Number(viewBox[2])) : null;
  return { svg: svg.trim(), width, height };
}

/** Rejects PDFs carrying active content markers (backend-plan 4.9). */
export function pdfHasActiveContent(buf: Buffer): boolean {
  const text = buf.toString('latin1');
  return /\/JavaScript|\/JS\b|\/Launch|\/OpenAction/.test(text);
}
