import sanitizeHtml from 'sanitize-html';

const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/**
 * Strict allow-list sanitiser for rich text (backend-plan 4.9). Images must point at the
 * media path or https; links are forced to noopener when opening a new tab.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'h2', 'h3', 'h4',
      'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
      'code', 'pre', 'span', 'iframe',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy'],
      '*': ['class'],
    },
    allowedClasses: { '*': [/^(tw-|prose-)/] },
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedIframeHostnames: ['www.youtube-nocookie.com'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const attrs = { ...attribs };
        if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer';
        return { tagName, attribs: attrs };
      },
    },
  });
}

/** Strips tags and control characters for plain-text fields. */
export function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
