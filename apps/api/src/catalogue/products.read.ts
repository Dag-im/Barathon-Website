import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { AppConfig, APP_CONFIG } from '../config/config';
import { ApiError } from '../common/utils/errors';
import { LIVE } from '../common/content/refs';
import { country, mediaOf, trimText } from './shared';
import { VideosReadService } from './videos.read';
import { buildSeo } from './seo-public';
import { SeoService } from '../seo/seo.service';
import { EntityType } from '@prisma/client';

export interface ProductListQuery {
  page: number;
  pageSize: number;
  q?: string;
  category?: string;
  brand?: string;
  country?: string;
  featured?: boolean;
  sort: 'order' | 'title' | '-title' | '-publishedAt';
}

const CARD_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true, logoMediaId: true } },
  category: { select: { id: true, name: true, slug: true } },
};

/** Public product read models: list with facets, FTS search, detail, downloads. */
@Injectable()
export class ProductsReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly videos: VideosReadService,
    private readonly seo: SeoService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  async cards(rows: any[]) {
    const media = await this.media.resolveMany([...rows.map((r) => r.heroImageMediaId), ...rows.map((r) => r.brand?.logoMediaId)]);
    return rows.map((r) => this.card(r, media));
  }

  card(row: any, media: Map<string, any>) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.shortDescription,
      image: mediaOf(media, row.heroImageMediaId),
      brand: row.brand ? { slug: row.brand.slug, name: row.brand.name, logo: mediaOf(media, row.brand.logoMediaId) } : null,
      category: row.category ? { slug: row.category.slug, name: row.category.name } : null,
      country: country(row.countryCode, row.countryName, row.originCity),
      isFeatured: row.isFeatured,
      href: `/products/${row.slug}`,
    };
  }

  async cardsForBrand(brandId: string) {
    const rows = await this.db.product.findMany({ where: { ...LIVE(), brandId }, include: CARD_INCLUDE, orderBy: [{ sortOrder: 'asc' }] });
    return this.cards(rows);
  }

  private orderFor(sort: ProductListQuery['sort']) {
    switch (sort) {
      case 'title':
        return [{ title: 'asc' as const }];
      case '-title':
        return [{ title: 'desc' as const }];
      case '-publishedAt':
        return [{ publishedAt: 'desc' as const }];
      default:
        return [{ sortOrder: 'asc' as const }, { title: 'asc' as const }];
    }
  }

  private whereFor(q: Omit<ProductListQuery, 'page' | 'pageSize' | 'sort' | 'q'> & { ids?: string[] }) {
    return {
      ...LIVE(),
      ...(q.category ? { category: { slug: q.category.toLowerCase() } } : {}),
      ...(q.brand ? { brand: { slug: q.brand.toLowerCase() } } : {}),
      ...(q.country ? { countryCode: q.country.toUpperCase() } : {}),
      ...(q.featured !== undefined ? { isFeatured: q.featured } : {}),
      ...(q.ids ? { id: { in: q.ids } } : {}),
    };
  }

  async listPublic(q: ProductListQuery) {
    let ids: string[] | undefined;
    let rankOrder: string[] | undefined;
    if (q.q) {
      rankOrder = await this.searchIds(q.q, 500);
      ids = rankOrder;
    }
    const where = this.whereFor({ ...q, ids });
    const [rows, total] = await Promise.all([
      this.db.product.findMany({ where, include: CARD_INCLUDE, orderBy: rankOrder ? undefined : this.orderFor(q.sort), skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.db.product.count({ where }),
    ]);
    let ordered = rows;
    if (rankOrder) {
      const pos = new Map(rankOrder.map((id, i) => [id, i]));
      ordered = [...rows].sort((a: any, b: any) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    }
    const data = await this.cards(ordered);
    return { data, meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) }, facets: await this.facets() };
  }

  /** Full-text plus trigram search: prefix matching on the last token, typo tolerance via similarity. */
  async searchIds(raw: string, limit: number): Promise<string[]> {
    const tokens = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    if (!tokens.length) return [];
    const prefix = tokens.map((t, i) => (i === tokens.length - 1 ? `${t}:*` : t)).join(' & ');
    const plain = tokens.join(' ');
    const rows = await this.prisma.client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p.id
      FROM products p
      WHERE p.status = 'PUBLISHED' AND p."deletedAt" IS NULL
        AND (
          p."searchVector" @@ to_tsquery('simple', unaccent(${prefix}))
          OR p."searchVector" @@ websearch_to_tsquery('simple', unaccent(${plain}))
          OR similarity(p.title, ${plain}) > 0.3
        )
      ORDER BY (ts_rank_cd(p."searchVector", to_tsquery('simple', unaccent(${prefix})))
                + similarity(p.title, ${plain})) DESC, p."sortOrder" ASC
      LIMIT ${limit}`);
    return rows.map((r) => r.id);
  }

  async search(q: string, limit: number) {
    const ids = await this.searchIds(q, limit);
    if (!ids.length) return [];
    const rows = await this.db.product.findMany({ where: { ...LIVE(), id: { in: ids } }, include: CARD_INCLUDE });
    const pos = new Map(ids.map((id, i) => [id, i]));
    const sorted = [...rows].sort((a: any, b: any) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    const media = await this.media.resolveMany(sorted.map((r: any) => r.heroImageMediaId));
    return sorted.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      shortDescription: trimText(r.shortDescription, 140),
      image: mediaOf(media, r.heroImageMediaId),
      brand: r.brand ? { slug: r.brand.slug, name: r.brand.name } : null,
      href: `/products/${r.slug}`,
    }));
  }

  async facets() {
    const rows = await this.db.product.findMany({
      where: LIVE(),
      select: { countryCode: true, countryName: true, brand: { select: { slug: true, name: true } }, category: { select: { slug: true, name: true } } },
    });
    const count = <T>(items: T[], key: (x: T) => string | null, label: (x: T) => string) => {
      const map = new Map<string, { slug: string; name: string; count: number }>();
      for (const it of items) {
        const k = key(it);
        if (!k) continue;
        const cur = map.get(k);
        if (cur) cur.count += 1;
        else map.set(k, { slug: k, name: label(it), count: 1 });
      }
      return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    };
    return {
      categories: count(rows, (r: any) => r.category?.slug ?? null, (r: any) => r.category.name),
      brands: count(rows, (r: any) => r.brand?.slug ?? null, (r: any) => r.brand.name),
      countries: rows
        .filter((r: any) => r.countryCode)
        .reduce((acc: Array<{ code: string; name: string; count: number }>, r: any) => {
          const hit = acc.find((c) => c.code === r.countryCode);
          if (hit) hit.count += 1;
          else acc.push({ code: r.countryCode, name: r.countryName ?? r.countryCode, count: 1 });
          return acc;
        }, []),
    };
  }

  async detailPublic(slug: string) {
    const row = await this.db.product.findFirst({
      where: { slug: slug.toLowerCase(), ...LIVE() },
      include: {
        ...CARD_INCLUDE,
        images: { orderBy: { sortOrder: 'asc' } },
        specs: { orderBy: { sortOrder: 'asc' } },
        documents: { where: { visibility: 'PUBLIC' }, orderBy: { sortOrder: 'asc' } },
        relatedFrom: { orderBy: { sortOrder: 'asc' }, include: { related: { include: CARD_INCLUDE } } },
      },
    });
    if (!row) throw ApiError.notFound('Product');
    const mediaIds = [row.heroImageMediaId, row.brand?.logoMediaId, ...row.images.map((i: any) => i.mediaId), ...row.documents.map((d: any) => d.mediaId)];
    const media = await this.media.resolveMany(mediaIds);
    let related = row.relatedFrom.map((r: any) => r.related).filter((r: any) => r.status === 'PUBLISHED' && !r.deletedAt);
    if (!related.length) {
      related = await this.db.product.findMany({
        where: { ...LIVE(), id: { not: row.id }, OR: [{ categoryId: row.categoryId ?? undefined }, { brandId: row.brandId ?? undefined }].filter((c) => Object.values(c).some((v) => v !== undefined)) },
        include: CARD_INCLUDE,
        take: 4,
      });
    }
    const relatedCards = (await this.cards(related.slice(0, 8)));
    const videos = await this.videos.forProduct(row.id);
    const seoRow = await this.seo.forEntity(EntityType.PRODUCT, row.id).catch(() => null);
    const card = this.card(row, media);
    const description = trimText(row.shortDescription, 160);
    const base = this.config.env.PUBLIC_SITE_URL.replace(/\/$/, '');
    const seo = await buildSeo(this.prisma, {
      seo: seoRow as any,
      fallbackTitle: row.title,
      fallbackDescription: description,
      path: `/products/${row.slug}`,
      type: 'product',
      image: mediaOf(media, row.heroImageMediaId),
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: row.title,
          description,
          sku: row.partNumber ?? undefined,
          image: mediaOf(media, row.heroImageMediaId)?.url,
          brand: row.brand ? { '@type': 'Brand', name: row.brand.name } : undefined,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
            { '@type': 'ListItem', position: 2, name: 'Products', item: `${base}/products` },
            { '@type': 'ListItem', position: 3, name: row.title, item: `${base}/products/${row.slug}` },
          ],
        },
      ],
    });
    return {
      ...card,
      contentHtml: row.contentHtml,
      tagline: row.tagline,
      partNumber: row.partNumber,
      inquiryEnabled: row.inquiryEnabled,
      gallery: row.images.map((i: any) => ({ id: i.id, media: mediaOf(media, i.mediaId), caption: i.caption ?? null })),
      specs: row.specs.map((s: any) => ({ groupName: s.groupName, label: s.label, value: s.value, unit: s.unit })),
      documents: row.documents.map((d: any) => ({
        id: d.id,
        title: d.title,
        language: d.language,
        sizeBytes: Number(media.get(d.mediaId)?.sizeBytes ?? 0),
        downloadUrl: `/api/v1/public/products/${row.slug}/documents/${d.id}/download`,
      })),
      related: relatedCards,
      videos,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      seo,
    };
  }

  /** Increments the counter and returns the public URL for a downloadable brochure. */
  async documentUrl(slug: string, documentId: string): Promise<string> {
    const row = await this.db.product.findFirst({ where: { slug: slug.toLowerCase(), ...LIVE() }, select: { id: true } });
    if (!row) throw ApiError.notFound('Product');
    const doc = await this.db.productDocument.findFirst({ where: { id: documentId, productId: row.id, visibility: 'PUBLIC' } });
    if (!doc) throw ApiError.notFound('Document');
    await this.db.productDocument.update({ where: { id: doc.id }, data: { downloadCount: { increment: 1 } } });
    const m = await this.media.resolveMany([doc.mediaId]);
    const url = m.get(doc.mediaId)?.url;
    if (!url) throw ApiError.notFound('Document');
    return url;
  }
}
