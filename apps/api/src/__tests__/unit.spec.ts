import { slugify } from '../common/utils/slug';
import { sanitizeRichText, plainText } from '../common/utils/sanitize';
import { parseYouTube, parseStart, youtubeEmbedUrl } from '../catalogue/youtube';
import { PasswordService } from '../auth/password.service';
import { RateWindow } from '../common/utils/rate-window';
import { sniff } from '../media/sniff';
import { sanitizeSvg, pdfHasActiveContent } from '../media/svg';
import { scoreSpam, makeReference, csvCell } from '../contact/contact.service';
import { normalisePath, RedirectsService } from '../redirects/redirects.service';
import { clean, country } from '../seed/text';
import { validateBlockData } from '../pages/pages.service';
import { sanitizeDiff } from '../audit/audit.service';
import { requestContext } from '../auth/auth.types';
import { hashSecret, deviceLabel } from './helpers-unit';

describe('slugify', () => {
  it('folds accents and produces lowercase hyphenated slugs', () => {
    expect(slugify('Walter Gerätebau')).toBe('walter-geratebau');
    expect(slugify('  FURUKAWA Rock Drills! ')).toBe('furukawa-rock-drills');
    expect(slugify('Crushing & Screening')).toBe('crushing-screening');
  });
});

describe('rich text sanitiser', () => {
  it('removes scripts and event handlers and forces noopener on blank targets', () => {
    const out = sanitizeRichText('<p onclick="x()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="https://a.example" target="_blank">go</a>');
    expect(out).not.toMatch(/script|onclick|onerror/);
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('plainText strips tags and control characters', () => {
    expect(plainText('<b>x</b>\u0007 y')).toBe('x y');
  });
});

describe('YouTube parsing', () => {
  it.each([
    ['https://www.youtube.com/watch?v=vOzKMq2qrFs&t=35s', 'vOzKMq2qrFs', 35],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ', 42],
    ['https://www.youtube.com/embed/tW0_L_POXeM?si=abc', 'tW0_L_POXeM', null],
    ['https://www.youtube.com/shorts/NK7LlrPrbE8', 'NK7LlrPrbE8', null],
    ['https://www.youtube.com/watch?v=NK7LlrPrbE8&t=1m5s', 'NK7LlrPrbE8', 65],
  ])('parses %s', (url, id, start) => {
    const p = parseYouTube(url);
    expect(p?.youtubeId).toBe(id);
    expect(p?.startSeconds ?? null).toBe(start);
  });

  it('rejects other hosts, javascript URLs and invalid ids', () => {
    expect(parseYouTube('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTube('javascript:alert(1)')).toBeNull();
    expect(parseYouTube('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYouTube('a')).toBeNull();
  });

  it('builds a privacy-enhanced embed URL', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', 12)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=12');
    expect(parseStart('90')).toBe(90);
  });
});

describe('password policy', () => {
  const svc = new PasswordService({ env: { ARGON2_MEMORY_KIB: 8192, ARGON2_TIME_COST: 2, PASSWORD_PEPPER: 'x'.repeat(32) } } as never);

  it('requires 12+ characters and rejects guessable phrases', () => {
    expect(svc.policyIssues('short1').map((i) => i.code)).toContain('too_short');
    expect(svc.policyIssues('password1234').map((i) => i.code)).toContain('weak');
  });

  it('rejects passwords containing the email local part and accepts strong ones', () => {
    expect(svc.policyIssues('my-aboma.taye-pass-9', 'aboma.taye').map((i) => i.code)).toContain('contains_email');
    expect(svc.policyIssues('Correct-Horse-Battery-9')).toEqual([]);
  });
});

describe('rate window', () => {
  it('limits hits per key within the window and reports retry time', () => {
    const w = new RateWindow(2, 60_000);
    const t = 1_000_000;
    expect(w.hit('a', t)).toBe(true);
    expect(w.hit('a', t + 1)).toBe(true);
    expect(w.hit('a', t + 2)).toBe(false);
    expect(w.retryAfter('a', t + 2)).toBeGreaterThan(0);
    expect(w.hit('a', t + 61_000)).toBe(true);
    expect(w.hit('b', t)).toBe(true);
  });
});

describe('file sniffing and SVG/PDF checks', () => {
  it('identifies real types from magic bytes, not names', () => {
    expect(sniff(Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(8)]))?.mime).toBe('image/png');
    expect(sniff(Buffer.from('%PDF-1.7\n' + 'x'.repeat(20)))?.mime).toBe('application/pdf');
    expect(sniff(Buffer.from('MZ this is an exe file with padding'))).toBeNull();
    expect(sniff(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(8)]))?.mime).toBe('video/mp4');
  });

  it('strips scripts, handlers and external references from SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20" onload="x()"><script>alert(1)</script><image xlink:href="https://evil.example/x.png"/><use href="#ok"/></svg>';
    const clean = sanitizeSvg(svg);
    expect(clean.svg).not.toMatch(/script|onload|evil\.example/);
    expect(clean.svg).toContain('href="#ok"');
    expect(clean.width).toBe(10);
    expect(clean.height).toBe(20);
  });

  it('flags PDFs with active content markers', () => {
    expect(pdfHasActiveContent(Buffer.from('%PDF-1.4 /OpenAction << >>'))).toBe(true);
    expect(pdfHasActiveContent(Buffer.from('%PDF-1.4 plain text'))).toBe(false);
  });
});

describe('contact pipeline helpers', () => {
  it('scores obvious spam above the threshold and clean messages below it', () => {
    const spam = scoreSpam({ message: 'crypto profit now http://a.example http://b.example http://c.example', email: 'x@mailinator.com', name: 'Jo', ipDuplicate: true, emailBlocked: false });
    expect(spam.score).toBeGreaterThanOrEqual(5);
    expect(spam.reasons).toEqual(expect.arrayContaining(['many-links', 'spam-phrase', 'disposable-domain']));
    const ham = scoreSpam({ message: 'We would like a quote for two rock drills.', email: 'buyer@company.et', name: 'Abebe', ipDuplicate: false, emailBlocked: false });
    expect(ham.score).toBeLessThan(5);
  });

  it('creates references in the BT-yymmdd-XXXX format', () => {
    expect(makeReference(new Date('2026-11-27T10:00:00Z'))).toMatch(/^BT-261127-[0-9A-Z]{4}$/);
  });

  it('neutralises spreadsheet formulas in CSV cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('plain')).toBe('plain');
  });
});

describe('redirects', () => {
  it('normalises paths to lowercase without trailing slash or query', () => {
    expect(normalisePath('/Products/Foo/?utm=1')).toBe('/products/foo');
    expect(normalisePath('/')).toBe('/');
  });

  it('refuses open-redirect targets', () => {
    const svc = new RedirectsService({ prisma: {} } as never, { env: { REDIRECT_ALLOWED_HOSTS: ['barathon.example'] } } as never);
    expect(() => svc.validateTarget('//evil.example', '/a')).toThrow();
    expect(() => svc.validateTarget('javascript:alert(1)', '/a')).toThrow();
    expect(() => svc.validateTarget('https://evil.example/x', '/a')).toThrow();
    expect(svc.validateTarget('https://barathon.example/x', '/a')).toBe('https://barathon.example/x');
    expect(svc.validateTarget('/brands/x', '/a')).toBe('/brands/x');
  });
});

describe('seed text cleanup', () => {
  it('applies the typo fixes and records them', () => {
    const fixes: Array<{ where: string; before: string; after: string }> = [];
    const out = clean('Walter Geratebou and Bussiness', 'test', fixes);
    expect(out).toBe('Walter Gerätebau and Business');
    expect(fixes.length).toBeGreaterThan(0);
  });

  it('normalises country strings', () => {
    expect(country('Ockelbo, Sweden')).toMatchObject({ code: 'SE', name: 'Sweden', city: 'Ockelbo' });
    expect(country('sweden')).toMatchObject({ code: 'SE' });
    expect(country('Atlantis').unmatched).toBe(true);
  });
});

describe('block validation and audit diffs', () => {
  it('rejects invalid block data and unknown keys', () => {
    expect(() => validateBlockData('HERO_CAROUSEL' as never, { autoplayMs: 10, source: 'FEATURED_PRODUCTS' })).toThrow();
    expect(() => validateBlockData('RICH_TEXT' as never, { html: '<p>x</p>', extra: 1 })).toThrow();
    expect(validateBlockData('RICH_TEXT' as never, { html: '<p>ok</p><script>x</script>' }).html).not.toContain('script');
  });

  it('never records secret fields in audit diffs and clips long text', () => {
    const diff = sanitizeDiff({ passwordHash: ['a', 'b'], title: ['x', 'y'], bodyHtml: ['z'.repeat(900), 'q'] });
    expect(diff).toEqual({ title: ['x', 'y'], bodyHtml: [expect.stringMatching(/\.\.\.$/), 'q'] });
  });
});

describe('request context', () => {
  it('normalises IPv4-mapped addresses and labels devices', () => {
    const ctx = requestContext({ headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0' }, ip: '::ffff:10.0.0.5', id: 'abc' });
    expect(ctx.ip).toBe('10.0.0.5');
    expect(ctx.requestId).toBe('abc');
    expect(deviceLabel(ctx.userAgent)).toBe('Chrome on Windows');
    expect(hashSecret('x')).toHaveLength(64);
  });
});
