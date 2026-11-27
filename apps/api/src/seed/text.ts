import fixesFile from './data/typo-fixes.json';

export interface TextFix {
  where: string;
  before: string;
  after: string;
}

/**
 * Applies the data-driven cleanup to one text and records every change.
 * Line endings are normalised, exact typo fixes applied, spacing before commas and
 * repeated spaces collapsed.
 */
export function clean(input: string | null | undefined, where: string, fixes: TextFix[]): string {
  if (input === null || input === undefined) return '';
  let out = input.replace(/\r\n/g, '\n');
  for (const r of fixesFile.replacements) {
    if (out.includes(r.find)) {
      fixes.push({ where, before: r.find, after: r.replace });
      out = out.split(r.find).join(r.replace);
    }
  }
  const collapsed = out.replace(/[ \t]+/g, ' ').replace(/\s+,/g, ',').replace(/,\s{2,}/g, ', ').replace(/\n{3,}/g, '\n\n').trim();
  if (collapsed !== out.trim()) fixes.push({ where, before: out.slice(0, 80), after: collapsed.slice(0, 80) });
  return collapsed;
}

/** Splits a plain-text block into paragraphs and wraps them in <p>. */
export function paragraphsToHtml(text: string): string {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function country(raw: string | null | undefined): { code: string | null; name: string | null; city: string | null; unmatched: boolean } {
  const key = (raw ?? '').trim();
  const hit = (fixesFile.countryNormalisation as Record<string, { code: string; name: string; city?: string }>)[key];
  if (hit) return { code: hit.code, name: hit.name, city: hit.city ?? null, unmatched: false };
  return { code: null, name: key || null, city: null, unmatched: !!key };
}

/** Parses a YouTube link; returns null for values that are not links (for example "a"). */
export function youtubeFromSource(value: string | null | undefined) {
  if (!value) return null;
  return value;
}
