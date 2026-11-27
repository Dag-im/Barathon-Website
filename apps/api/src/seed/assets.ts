import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { AppConfig } from '../config/config';
import { SeedReport } from './seed';

const MANIFEST = resolve(process.cwd(), 'assets-manifest.json');
const MAX_BYTES = 12 * 1024 * 1024;
const RETRIES = 3;

/**
 * Downloads source images from allow-listed hosts only (SSRF guard), stores them through the
 * media pipeline, and links them to products, brands, services and the site logo.
 * Failures are recorded in the report and leave the entity without an image.
 */
export async function seedAssets(app: { prisma: PrismaService; media: MediaService; config: AppConfig }, report: SeedReport, sourceDir: string): Promise<{ ok: number; failed: number }> {
  const hosts = app.config.env.SEED_ASSET_HOSTS;
  const timeout = app.config.env.SEED_DOWNLOAD_TIMEOUT_MS;
  const manifest: Record<string, string> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const db = app.prisma.client;
  let ok = 0;
  let failed = 0;

  async function mediaFor(url: string, entity: string): Promise<string | null> {
    if (manifest[url]) return manifest[url];
    const host = new URL(url).hostname;
    if (new URL(url).protocol !== 'https:' || !hosts.includes(host)) {
      report.assetFailures.push({ entity, url, reason: 'host not allow-listed' });
      failed++;
      return null;
    }
    let lastError = 'unknown';
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeout) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_BYTES) throw new Error('file too large');
        const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'image');
        const { media } = await app.media.upload({ buffer: buf, originalName: name, intent: 'IMAGE' }, { userId: null, email: null, ip: null, userAgent: null, requestId: null });
        manifest[url] = media.id;
        writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
        ok++;
        return media.id;
      } catch (err) {
        lastError = (err as Error).message;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    report.assetFailures.push({ entity, url, reason: lastError });
    failed++;
    return null;
  }

  for (const p of await db.product.findMany({ where: { legacyId: { not: null } } })) {
    const src = JSON.parse(readFileSync(join(sourceDir, 'product.json'), 'utf8')).find((x: any) => x._id === p.legacyId);
    if (!src?.image || p.heroImageMediaId) continue;
    const id = await mediaFor(src.image, `product:${p.slug}`);
    if (id) await db.product.update({ where: { id: p.id }, data: { heroImageMediaId: id } });
  }
  const companies = JSON.parse(readFileSync(join(sourceDir, 'company.json'), 'utf8'));
  for (const b of await db.brand.findMany({ where: { legacyId: { not: null } } })) {
    const src = companies.find((x: any) => x._id === b.legacyId);
    if (!src?.logo_image || b.logoMediaId) continue;
    const id = await mediaFor(src.logo_image, `brand:${b.slug}`);
    if (id) await db.brand.update({ where: { id: b.id }, data: { logoMediaId: id } });
  }
  const services = JSON.parse(readFileSync(join(sourceDir, 'service.json'), 'utf8'));
  for (const s of await db.service.findMany({ where: { legacyId: { not: null } } })) {
    const src = services.find((x: any) => x._id === s.legacyId);
    if (!src?.image || s.imageMediaId) continue;
    const id = await mediaFor(src.image, `service:${s.slug}`);
    if (id) await db.service.update({ where: { id: s.id }, data: { imageMediaId: id } });
  }

  // Site logo from the local file (no download).
  const logoPath = join(sourceDir, 'logo.png');
  if (existsSync(logoPath)) {
    const existing = await db.media.findFirst({ where: { originalName: 'logo.png' } });
    const logoId =
      existing?.id ??
      (await app.media.upload({ buffer: readFileSync(logoPath), originalName: 'logo.png', intent: 'IMAGE', alt: 'Barathon Trading logo' }, { userId: null, email: null, ip: null, userAgent: null, requestId: null })).media.id;
    await db.siteSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', siteName: 'Barathon Trading', brandColors: {}, headerCta: {}, search: {}, copyrightText: '', footerCredit: {}, seoDefaults: {}, analytics: {}, maintenance: {}, announcement: {}, contactForm: {}, robots: {}, sitemap: {}, logoLightMediaId: logoId }, update: { logoLightMediaId: logoId } });
    const home = await db.page.findFirst({ where: { key: 'home' }, include: { blocks: true } });
    const imageBlock = home?.blocks.find((b) => b.type === 'IMAGE_TEXT');
    if (imageBlock && !(imageBlock.data as any).imageMediaId) {
      await db.pageBlock.update({ where: { id: imageBlock.id }, data: { data: { ...(imageBlock.data as object), imageMediaId: logoId } } });
    }
  }
  return { ok, failed };
}
