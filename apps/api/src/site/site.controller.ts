import { Controller, Get, Inject, Injectable, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { Public } from '../common/decorators/access.decorators';
import { parse } from '../common/content/crud.controller';
import { ApiError } from '../common/utils/errors';
import { LIVE } from '../common/content/refs';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService, UiStringService } from '../settings/settings.service';
import { NavigationService } from '../navigation/navigation.service';
import { country } from '../catalogue/shared';
import { MediaService } from '../media/media.service';
import { AppConfig, APP_CONFIG } from '../config/config';
import { ProductsReadService } from '../catalogue/products.read';

const contactHref = (type: string, value: string): string => {
  if (type === 'PHONE' || type === 'FAX') return `tel:${value}`;
  if (type === 'EMAIL') return `mailto:${value}`;
  if (type === 'WHATSAPP') return `https://wa.me/${value.replace(/\D/g, '')}`;
  return value;
};

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
  videos?: VideoSitemapItem[];
}

export interface VideoSitemapItem {
  title: string;
  description: string;
  thumbnailLoc: string | null;
  playerLoc: string | null;
  contentLoc: string | null;
  publicationDate: string;
}

/** Public read models for the site shell, sitemap, robots, search and slug lists. */
@Injectable()
export class SiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly nav: NavigationService,
    private readonly ui: UiStringService,
    private readonly media: MediaService,
    private readonly products: ProductsReadService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  async site() {
    const core = await this.settings.publicCore();
    const [socials, channels, offices, menus, uiStrings] = await Promise.all([
      this.db.socialLink.findMany({ where: { visible: true, url: { not: null } }, orderBy: { sortOrder: 'asc' } }),
      this.db.contactChannel.findMany({ where: { visible: true }, orderBy: { sortOrder: 'asc' } }),
      this.db.office.findMany({ where: { visible: true }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] }),
      this.nav.publicAll(),
      this.ui.merged(),
    ]);
    return {
      ...core,
      social: socials.map((s) => ({ id: s.id, platform: s.platform, url: s.url, label: s.label, showInFooter: s.showInFooter, showOnContactPage: s.showOnContactPage })),
      channels: channels.map((c) => ({
        id: c.id,
        type: c.type,
        label: c.label,
        value: c.value,
        displayValue: c.displayValue ?? c.value,
        href: contactHref(c.type, c.value),
        showOnContactPage: c.showOnContactPage,
        showInFooter: c.showInFooter,
        showInHeader: c.showInHeader,
      })),
      offices: offices.map((o) => ({
        id: o.id,
        name: o.name,
        isPrimary: o.isPrimary,
        lines: [o.addressLine1, o.addressLine2, o.poBox ? `P.O.Box ${o.poBox}` : null, [o.city, o.region].filter(Boolean).join(', '), o.countryName].filter((x): x is string => !!x),
        countryCode: o.countryCode,
        countryName: o.countryName,
        city: o.city,
        latitude: o.latitude,
        longitude: o.longitude,
        mapEmbedUrl: o.mapEmbedUrl,
        openingHours: o.openingHours,
      })),
      menus,
      uiStrings,
    };
  }

  async sitemapEntries(): Promise<SitemapEntry[]> {
    const base = this.config.env.PUBLIC_SITE_URL.replace(/\/$/, '');
    const settings = await this.db.siteSettings.findUnique({ where: { id: 'singleton' } });
    const sitemapCfg = (settings?.sitemap ?? {}) as { excludeTypes?: string[]; perType?: Record<string, { changefreq: string; priority: number }> };
    const noindexSite = !!(settings?.seoDefaults as { siteNoindex?: boolean } | undefined)?.siteNoindex;
    if (noindexSite) return [];
    const exclude = new Set(sitemapCfg.excludeTypes ?? []);
    const per = (t: string, fallback: { changefreq: string; priority: number }) => sitemapCfg.perType?.[t] ?? fallback;
    const now = new Date().toISOString();
    const out: SitemapEntry[] = [];
    const add = (path: string, lastmod: Date | string, t: { changefreq: string; priority: number }) =>
      out.push({ loc: `${base}${path}`, lastmod: typeof lastmod === 'string' ? lastmod : lastmod.toISOString(), changefreq: t.changefreq, priority: t.priority });

    add('/', now, per('HOME', { changefreq: 'weekly', priority: 1 }));
    for (const p of ['/about', '/products', '/brands', '/services', '/news', '/contact']) add(p, now, { changefreq: 'monthly', priority: 0.7 });

    if (!exclude.has('PRODUCT')) {
      for (const r of await this.db.product.findMany({ where: LIVE(), select: { slug: true, updatedAt: true } })) add(`/products/${r.slug}`, r.updatedAt, per('PRODUCT', { changefreq: 'monthly', priority: 0.8 }));
    }
    if (!exclude.has('BRAND')) {
      for (const r of await this.db.brand.findMany({ where: LIVE(), select: { slug: true, updatedAt: true } })) add(`/brands/${r.slug}`, r.updatedAt, per('BRAND', { changefreq: 'monthly', priority: 0.7 }));
    }
    if (!exclude.has('SERVICE')) {
      for (const r of await this.db.service.findMany({ where: LIVE(), select: { slug: true, updatedAt: true } })) add(`/services/${r.slug}`, r.updatedAt, per('SERVICE', { changefreq: 'monthly', priority: 0.7 }));
    }
    if (!exclude.has('POST')) {
      for (const r of await this.db.post.findMany({ where: LIVE(), select: { slug: true, updatedAt: true } })) add(`/news/${r.slug}`, r.updatedAt, per('POST', { changefreq: 'monthly', priority: 0.6 }));
    }
    for (const p of await this.db.page.findMany({ where: { ...LIVE(), showInSitemap: true }, select: { slug: true, updatedAt: true } })) {
      if (p.slug === 'home' || p.slug === 'about') continue;
      add(`/${p.slug}`, p.updatedAt, per('PAGE', { changefreq: 'monthly', priority: 0.5 }));
    }
    for (const c of await this.db.productCategory.findMany({ where: LIVE(), select: { slug: true, updatedAt: true } })) {
      add(`/products/category/${c.slug}`, c.updatedAt, per('PRODUCT_CATEGORY', { changefreq: 'monthly', priority: 0.6 }));
    }

    // VideoObject entries (A6): each brand page lists its live videos with player/content locations.
    const videos = await this.db.video.findMany({ where: LIVE(), include: { brand: { select: { slug: true } } } });
    const mediaIds = videos.flatMap((v) => [v.posterMediaId, v.mediaId]);
    const media = await this.media.resolveMany(mediaIds);
    for (const v of videos) {
      if (!v.brand?.slug) continue;
      const entry = out.find((e) => e.loc === `${base}/brands/${v.brand?.slug}`);
      if (!entry) continue;
      const item: VideoSitemapItem = {
        title: v.title,
        description: v.description ?? v.title,
        thumbnailLoc: media.get(v.posterMediaId ?? '')?.url ?? (v.sourceType === 'YOUTUBE' && v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : null),
        playerLoc: v.sourceType === 'YOUTUBE' && v.youtubeId ? `https://www.youtube-nocookie.com/embed/${v.youtubeId}` : null,
        contentLoc: v.sourceType === 'UPLOAD' ? media.get(v.mediaId ?? '')?.url ?? null : null,
        publicationDate: (v.publishedAt ?? v.createdAt).toISOString(),
      };
      entry.videos = [...(entry.videos ?? []), item];
    }
    return out;
  }

  async robotsText(): Promise<string> {
    const base = this.config.env.PUBLIC_SITE_URL.replace(/\/$/, '');
    const settings = await this.db.siteSettings.findUnique({ where: { id: 'singleton' } });
    const seo = (settings?.seoDefaults ?? {}) as { siteNoindex?: boolean };
    const robots = (settings?.robots ?? {}) as { extraRules?: string; disallow?: string[] };
    if (seo.siteNoindex) return 'User-agent: *\nDisallow: /\n';
    const lines = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api', 'Disallow: /search', ...(robots.disallow ?? []).map((p) => `Disallow: ${p}`)];
    if (robots.extraRules) lines.push(robots.extraRules.trim());
    lines.push('', `Sitemap: ${base}/sitemap.xml`);
    return `${lines.join('\n')}\n`;
  }

  async search(q: string, types: string[], limit: number) {
    const want = (t: string) => types.length === 0 || types.includes(t);
    const like = { contains: q, mode: 'insensitive' as const };
    const [products, brands, services, posts, pages] = await Promise.all([
      want('products') ? this.products.search(q, limit) : [],
      want('brands') ? this.db.brand.findMany({ where: { ...LIVE(), OR: [{ name: like }, { shortDescription: like }] }, take: limit }) : [],
      want('services') ? this.db.service.findMany({ where: { ...LIVE(), OR: [{ title: like }, { shortDescription: like }] }, take: limit }) : [],
      want('posts') ? this.db.post.findMany({ where: { ...LIVE(), OR: [{ title: like }, { excerpt: like }] }, take: limit }) : [],
      want('pages') ? this.db.page.findMany({ where: { ...LIVE(), title: like }, take: limit }) : [],
    ]);
    return {
      products,
      brands: brands.map((b) => ({ id: b.id, title: b.name, href: `/brands/${b.slug}`, excerpt: b.shortDescription })),
      services: services.map((s) => ({ id: s.id, title: s.title, href: `/services/${s.slug}`, excerpt: s.shortDescription })),
      posts: posts.map((p) => ({ id: p.id, title: p.title, href: `/news/${p.slug}`, excerpt: p.excerpt })),
      pages: pages.map((p) => ({ id: p.id, title: p.title, href: p.slug === 'home' ? '/' : `/${p.slug}` })),
    };
  }

  async slugs(type: string) {
    const live = LIVE();
    const rows: Array<{ slug: string; updatedAt: Date }> | null =
      type === 'products' ? await this.db.product.findMany({ where: live, select: { slug: true, updatedAt: true } })
      : type === 'brands' ? await this.db.brand.findMany({ where: live, select: { slug: true, updatedAt: true } })
      : type === 'services' ? await this.db.service.findMany({ where: live, select: { slug: true, updatedAt: true } })
      : type === 'posts' ? await this.db.post.findMany({ where: live, select: { slug: true, updatedAt: true } })
      : type === 'pages' ? await this.db.page.findMany({ where: { ...live, isSystem: false }, select: { slug: true, updatedAt: true } })
      : type === 'categories' ? await this.db.productCategory.findMany({ where: live, select: { slug: true, updatedAt: true } })
      : null;
    if (!rows) throw ApiError.notFound('Slug type');
    return { data: rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt.toISOString() })) };
  }
}

@ApiTags('public-site')
@Controller('public')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Public()
  @Get('site')
  bootstrap() {
    return this.site.site();
  }

  @Public()
  @Get('sitemap')
  async sitemap() {
    return { data: await this.site.sitemapEntries() };
  }

  @Public()
  @Get('sitemap.xml')
  async sitemapXml(@Res() res: Response): Promise<void> {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const urls = (await this.site.sitemapEntries()).map((e) => {
      const videos = (e.videos ?? [])
        .map(
          (v) =>
            `<video:video>${v.thumbnailLoc ? `<video:thumbnail_loc>${esc(v.thumbnailLoc)}</video:thumbnail_loc>` : ''}<video:title>${esc(v.title)}</video:title><video:description>${esc(v.description)}</video:description>${v.playerLoc ? `<video:player_loc>${esc(v.playerLoc)}</video:player_loc>` : ''}${v.contentLoc ? `<video:content_loc>${esc(v.contentLoc)}</video:content_loc>` : ''}<video:publication_date>${esc(v.publicationDate)}</video:publication_date></video:video>`,
        )
        .join('');
      return `<url><loc>${esc(e.loc)}</loc><lastmod>${esc(e.lastmod)}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority.toFixed(1)}</priority>${videos}</url>`;
    });
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${urls.join('\n')}\n</urlset>\n`);
  }

  @Public()
  @Get('robots.txt')
  async robots(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(await this.site.robotsText());
  }

  @Public()
  @Get('search')
  search(@Query() query: Record<string, string>) {
    const q = parse(z.object({ q: z.string().trim().min(2, 'q must be at least 2 characters').max(80), types: z.string().optional(), limit: z.coerce.number().int().min(1).max(10).default(10) }).strict(), query);
    const types = q.types ? q.types.split(',').map((t) => t.trim()).filter(Boolean) : [];
    return this.site.search(q.q, types, q.limit);
  }

  @Public()
  @Get('slugs/:type')
  slugs(@Param('type') type: string) {
    return this.site.slugs(type);
  }
}
