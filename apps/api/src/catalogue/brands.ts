import { Body, Controller, Get, Injectable, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { BrandKind, EntityType } from '@prisma/client';
import { Public } from '../common/decorators/access.decorators';
import { CrudAdminController, parse } from '../common/content/crud.controller';
import { PublishableCrud } from '../common/content/content-crud';
import { assertMedia, LIVE } from '../common/content/refs';
import { sanitizeRichText, plainText } from '../common/utils/sanitize';
import { paged, skipTake } from '../common/utils/pagination';
import { ApiError } from '../common/utils/errors';
import { TagSet } from '../common/constants/revalidation-map';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { SeoService } from '../seo/seo.service';
import { MediaRefService } from '../media/media.refs';
import { RedirectsService } from '../redirects/redirects.service';
import { MediaService } from '../media/media.service';
import { country, mediaOf } from './shared';
import { buildSeo } from './seo-public';
import { ProductsReadService } from './products.read';
import { VideosReadService } from './videos.read';
import { trimText } from './shared';

const url = z.string().url().max(500).regex(/^https:\/\//).nullable();
export const brandInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().max(96).optional(),
    kind: z.nativeEnum(BrandKind).default(BrandKind.PARTNER),
    shortDescription: z.string().trim().min(1).max(600),
    descriptionHtml: z.string().max(100_000).nullable().optional(),
    logoMediaId: z.string().uuid().nullable().optional(),
    logoDarkMediaId: z.string().uuid().nullable().optional(),
    heroImageMediaId: z.string().uuid().nullable().optional(),
    countryCode: z.string().length(2).nullable().optional(),
    countryName: z.string().max(80).nullable().optional(),
    city: z.string().max(80).nullable().optional(),
    websiteUrl: url.optional(),
    isFeatured: z.boolean().optional(),
    showInMarquee: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    seo: z.any().optional(),
  })
  .strict();
export const brandUpdate = brandInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

export interface BrandAdminRow {
  id: string;
  version: number;
  status: string;
  [k: string]: any;
}

@Injectable()
export class BrandsService extends PublishableCrud<any> {
  protected readonly delegate = 'brand';
  protected readonly entityName = 'brand';
  protected readonly seoType: EntityType = EntityType.BRAND;
  protected readonly searchFields = ['name', 'shortDescription'];

  constructor(
    prisma: PrismaService,
    audit: AuditService,
    revalidation: RevalidationService,
    seo: SeoService,
    refs: MediaRefService,
    redirects: RedirectsService,
    private readonly media: MediaService,
  ) {
    super(prisma, audit, revalidation, seo, refs, redirects);
  }

  protected publicPath(slug: string): string {
    return `/brands/${slug}`;
  }

  protected tags(row: any): TagSet {
    return { tags: ['brands', 'products', 'sitemap', 'page:home', ...(row.slug ? [`brand:${row.slug}`] : [])], paths: row.slug ? ['/brands', `/brands/${row.slug}`] : ['/brands'] };
  }

  protected async mediaIndex(row: any) {
    return { refs: [{ field: 'logoMediaId', mediaId: row.logoMediaId }, { field: 'logoDarkMediaId', mediaId: row.logoDarkMediaId }, { field: 'heroImageMediaId', mediaId: row.heroImageMediaId }], html: [{ field: 'descriptionHtml', html: row.descriptionHtml }] };
  }

  protected async prepare(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const i = input as any;
    await assertMedia(this.prisma, [i.logoMediaId, i.logoDarkMediaId, i.heroImageMediaId], ['IMAGE', 'SVG', 'ICON'], 'logoMediaId');
    const data: Record<string, unknown> = {};
    const copy = ['name', 'kind', 'shortDescription', 'logoMediaId', 'logoDarkMediaId', 'heroImageMediaId', 'countryCode', 'countryName', 'city', 'websiteUrl', 'isFeatured', 'showInMarquee', 'sortOrder', 'slug'];
    for (const k of copy) if (i[k] !== undefined) data[k] = i[k];
    if (i.name !== undefined) data.name = plainText(i.name);
    if (i.shortDescription !== undefined) data.shortDescription = plainText(i.shortDescription);
    if (i.descriptionHtml !== undefined) data.descriptionHtml = sanitizeRichText(i.descriptionHtml);
    if (i.countryCode) data.countryCode = String(i.countryCode).toUpperCase();
    return data;
  }

  protected async dto(row: any) {
    const media = await this.media.resolveMany([row.logoMediaId, row.logoDarkMediaId, row.heroImageMediaId]);
    const seo = await this.seo.forEntity(EntityType.BRAND, row.id);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: row.kind,
      shortDescription: row.shortDescription,
      descriptionHtml: row.descriptionHtml,
      logoMediaId: row.logoMediaId,
      logoDarkMediaId: row.logoDarkMediaId,
      heroImageMediaId: row.heroImageMediaId,
      logo: mediaOf(media, row.logoMediaId),
      logoDark: mediaOf(media, row.logoDarkMediaId),
      heroImage: mediaOf(media, row.heroImageMediaId),
      countryCode: row.countryCode,
      countryName: row.countryName,
      city: row.city,
      websiteUrl: row.websiteUrl,
      isFeatured: row.isFeatured,
      showInMarquee: row.showInMarquee,
      sortOrder: row.sortOrder,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      seo: seo ?? null,
      warnings: row.status === 'PUBLISHED' && !row.logoMediaId ? [{ code: 'MISSING_IMAGE', message: 'Brand has no logo' }] : [],
    };
  }

  /** Public card projection (BrandCardDto). */
  card(row: any, media: Map<string, any>) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      shortDescription: row.shortDescription,
      logo: mediaOf(media, row.logoMediaId),
      logoDark: mediaOf(media, row.logoDarkMediaId),
      country: country(row.countryCode, row.countryName, row.city),
      href: `/brands/${row.slug}`,
    };
  }

  async listPublic(q: { kind?: BrandKind; country?: string; page: number; pageSize: number }) {
    const where: Record<string, unknown> = { ...LIVE(), ...(q.kind ? { kind: q.kind } : {}), ...(q.country ? { countryCode: q.country.toUpperCase() } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.client.brand.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], ...skipTake(q.page, q.pageSize) }),
      this.prisma.client.brand.count({ where }),
    ]);
    const media = await this.media.resolveMany(rows.flatMap((r) => [r.logoMediaId, r.logoDarkMediaId]));
    return paged(rows.map((r) => this.card(r, media)), total, q.page, q.pageSize);
  }

  /** Marquee list: all live brands in sort order (BRANDS_MARQUEE). */
  async marquee(ids?: string[]) {
    const where: Record<string, unknown> = { ...LIVE(), showInMarquee: true, ...(ids?.length ? { id: { in: ids } } : {}) };
    const rows = await this.prisma.client.brand.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const media = await this.media.resolveMany(rows.flatMap((r) => [r.logoMediaId, r.logoDarkMediaId]));
    const cards = rows.map((r) => this.card(r, media));
    return ids?.length ? ids.map((id) => cards.find((c) => c.id === id)).filter(Boolean) : cards;
  }

  async detailPublic(slug: string, products: ProductsReadService, videos: VideosReadService) {
    const row = await this.prisma.client.brand.findFirst({ where: { slug: slug.toLowerCase(), ...LIVE() } });
    if (!row) throw ApiError.notFound('Brand');
    const media = await this.media.resolveMany([row.logoMediaId, row.logoDarkMediaId, row.heroImageMediaId]);
    const seoRow = await this.seo.forEntity(EntityType.BRAND, row.id);
    const brandVideos = await videos.forBrand(row.id);
    const brandProducts = await products.cardsForBrand(row.id);
    const card = this.card(row, media);
    const seo = await buildSeo(this.prisma, {
      seo: seoRow,
      fallbackTitle: row.name,
      fallbackDescription: trimText(row.shortDescription, 160),
      path: `/brands/${row.slug}`,
      type: 'website',
      image: mediaOf(media, row.heroImageMediaId ?? row.logoMediaId),
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'Organization', name: row.name, url: row.websiteUrl ?? undefined, logo: media.get(row.logoMediaId ?? '')?.url }],
    });
    return {
      ...card,
      descriptionHtml: row.descriptionHtml,
      heroImage: mediaOf(media, row.heroImageMediaId),
      websiteUrl: row.websiteUrl,
      videos: brandVideos,
      products: brandProducts,
      seo,
    };
  }
}

@ApiTags('admin-brands')
@Controller('admin/brands')
export class BrandsAdminController extends CrudAdminController {
  protected readonly createSchema = brandInput;
  protected readonly updateSchema = brandUpdate;
  constructor(readonly crud: BrandsService) {
    super();
  }
}

@ApiTags('public-brands')
@Controller('public/brands')
export class BrandsPublicController {
  constructor(
    private readonly brands: BrandsService,
    private readonly products: ProductsReadService,
    private readonly videos: VideosReadService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: Record<string, string>) {
    const q = parse(
      z.object({
        kind: z.nativeEnum(BrandKind).optional(),
        country: z.string().length(2).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      }).strict(),
      query,
    );
    return this.brands.listPublic(q);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.brands.detailPublic(slug, this.products, this.videos);
  }
}

