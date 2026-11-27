import { Body, Controller, Get, Injectable, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { DocumentLanguage, EntityType } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/access.decorators';
import { CrudAdminController, parse, crudContext } from '../common/content/crud.controller';
import { PublishableCrud, CrudContext } from '../common/content/content-crud';
import { assertLive, assertMedia } from '../common/content/refs';
import { sanitizeRichText, plainText } from '../common/utils/sanitize';
import { ApiError } from '../common/utils/errors';
import { TagSet } from '../common/constants/revalidation-map';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { SeoService } from '../seo/seo.service';
import { MediaRefService } from '../media/media.refs';
import { RedirectsService } from '../redirects/redirects.service';
import { MediaService } from '../media/media.service';
import { mediaOf } from './shared';
import { ProductsReadService } from './products.read';
import { LIVE } from '../common/content/refs';

const id = z.string().uuid();
export const productInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    slug: z.string().max(96).optional(),
    shortDescription: z.string().trim().min(1).max(600),
    contentHtml: z.string().max(200_000).optional(),
    tagline: z.string().max(200).nullable().optional(),
    heroImageMediaId: id.nullable().optional(),
    brandId: id.nullable().optional(),
    categoryId: id.nullable().optional(),
    extraCategoryIds: z.array(id).max(10).optional(),
    countryCode: z.string().length(2).nullable().optional(),
    countryName: z.string().max(80).nullable().optional(),
    originCity: z.string().max(80).nullable().optional(),
    isFeatured: z.boolean().optional(),
    inquiryEnabled: z.boolean().optional(),
    partNumber: z.string().max(60).nullable().optional(),
    sortOrder: z.number().int().optional(),
    images: z.array(z.object({ mediaId: id, caption: z.string().max(300).nullable().optional(), altOverride: z.string().max(300).nullable().optional() }).strict()).max(30).optional(),
    specs: z.array(z.object({ groupName: z.string().max(80).nullable().optional(), label: z.string().min(1).max(120), value: z.string().min(1).max(300), unit: z.string().max(30).nullable().optional() }).strict()).max(100).optional(),
    documents: z.array(z.object({ title: z.string().min(1).max(160), mediaId: id, language: z.nativeEnum(DocumentLanguage).optional() }).strict()).max(20).optional(),
    relatedIds: z.array(id).max(8).optional(),
    seo: z.any().optional(),
  })
  .strict();
export const productUpdate = productInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

@Injectable()
export class ProductsService extends PublishableCrud<any> {
  protected readonly delegate = 'product';
  protected readonly entityName = 'product';
  protected readonly seoType: EntityType = EntityType.PRODUCT;
  protected readonly searchFields = ['title', 'shortDescription'];

  constructor(
    prisma: PrismaService,
    audit: AuditService,
    revalidation: RevalidationService,
    seo: SeoService,
    refs: MediaRefService,
    redirects: RedirectsService,
    private readonly media: MediaService,
    private readonly reads: ProductsReadService,
  ) {
    super(prisma, audit, revalidation, seo, refs, redirects);
  }

  protected include() {
    return { brand: { select: { id: true, name: true, slug: true } }, category: { select: { id: true, name: true, slug: true } } };
  }

  protected publicPath(slug: string): string {
    return `/products/${slug}`;
  }

  protected tags(row: any): TagSet {
    const slug = row.slug as string | undefined;
    return {
      tags: ['products', 'sitemap', 'hero', 'page:home', 'search', ...(slug ? [`product:${slug}`] : [])],
      paths: ['/products', ...(slug ? [`/products/${slug}`] : [])],
    };
  }

  protected async mediaIndex(row: any) {
    const [images, docs] = await Promise.all([
      this.prisma.client.productImage.findMany({ where: { productId: row.id }, select: { mediaId: true } }),
      this.prisma.client.productDocument.findMany({ where: { productId: row.id }, select: { mediaId: true } }),
    ]);
    return {
      refs: [{ field: 'heroImageMediaId', mediaId: row.heroImageMediaId }, ...images.map((i) => ({ field: 'gallery', mediaId: i.mediaId })), ...docs.map((d) => ({ field: 'document', mediaId: d.mediaId }))],
      html: [{ field: 'contentHtml', html: row.contentHtml }],
    };
  }

  protected async prepare(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const i = input as any;
    await assertMedia(this.prisma, [i.heroImageMediaId], ['IMAGE', 'SVG'], 'heroImageMediaId');
    await assertLive(this.prisma, 'brand', i.brandId, 'brandId');
    await assertLive(this.prisma, 'productCategory', i.categoryId, 'categoryId');
    const data: Record<string, unknown> = {};
    const copy = ['title', 'slug', 'shortDescription', 'tagline', 'heroImageMediaId', 'brandId', 'categoryId', 'extraCategoryIds', 'countryName', 'originCity', 'isFeatured', 'inquiryEnabled', 'partNumber', 'sortOrder'];
    for (const k of copy) if (i[k] !== undefined) data[k] = i[k];
    if (i.title !== undefined) data.title = plainText(i.title);
    if (i.shortDescription !== undefined) data.shortDescription = plainText(i.shortDescription);
    if (i.contentHtml !== undefined) data.contentHtml = sanitizeRichText(i.contentHtml);
    if (i.countryCode !== undefined) data.countryCode = i.countryCode ? String(i.countryCode).toUpperCase() : null;
    return data;
  }

  /** Replaces gallery, specs, documents and related items when they are supplied. */
  protected async afterWrite(row: any, input: Record<string, unknown> | null): Promise<void> {
    const i = (input ?? {}) as any;
    const db = this.prisma.client;
    if (i.images !== undefined) {
      await assertMedia(this.prisma, i.images.map((x: any) => x.mediaId), ['IMAGE', 'SVG'], 'images');
      await db.$transaction([
        db.productImage.deleteMany({ where: { productId: row.id } }),
        db.productImage.createMany({ data: i.images.map((x: any, n: number) => ({ productId: row.id, mediaId: x.mediaId, caption: x.caption ?? null, altOverride: x.altOverride ?? null, sortOrder: n })) }),
      ]);
    }
    if (i.specs !== undefined) {
      await db.$transaction([
        db.productSpec.deleteMany({ where: { productId: row.id } }),
        db.productSpec.createMany({ data: i.specs.map((s: any, n: number) => ({ productId: row.id, groupName: s.groupName ?? null, label: plainText(s.label), value: plainText(s.value), unit: s.unit ?? null, sortOrder: n })) }),
      ]);
    }
    if (i.documents !== undefined) {
      await assertMedia(this.prisma, i.documents.map((d: any) => d.mediaId), ['DOCUMENT'], 'documents');
      const existing = await db.productDocument.findMany({ where: { productId: row.id } });
      await db.$transaction([
        db.productDocument.deleteMany({ where: { productId: row.id } }),
        db.productDocument.createMany({
          data: i.documents.map((d: any, n: number) => {
            const prev = existing.find((e: any) => e.mediaId === d.mediaId);
            return { productId: row.id, title: plainText(d.title), mediaId: d.mediaId, language: d.language ?? 'EN', visibility: 'PUBLIC', sortOrder: n, downloadCount: prev?.downloadCount ?? 0 };
          }),
        }),
      ]);
    }
    if (i.relatedIds !== undefined) {
      if (i.relatedIds.includes(row.id)) throw ApiError.validation([{ field: 'relatedIds', message: 'A product cannot relate to itself' }]);
      const found = await db.product.findMany({ where: { id: { in: i.relatedIds }, ...LIVE() }, select: { id: true } });
      if (found.length !== new Set(i.relatedIds).size) throw ApiError.validation([{ field: 'relatedIds', message: 'Some related products do not exist' }]);
      await db.$transaction([
        db.productRelated.deleteMany({ where: { productId: row.id } }),
        db.productRelated.createMany({ data: i.relatedIds.map((rid: string, n: number) => ({ productId: row.id, relatedProductId: rid, sortOrder: n })) }),
      ]);
    }
  }

  protected async validatePublish(row: any): Promise<void> {
    if (!row.title || !row.shortDescription) throw ApiError.validation([{ field: 'title', message: 'Title and short description are required to publish' }]);
  }

  protected async dto(row: any) {
    const db = this.prisma.client;
    const [images, specs, documents, related, seo] = await Promise.all([
      db.productImage.findMany({ where: { productId: row.id }, orderBy: { sortOrder: 'asc' } }),
      db.productSpec.findMany({ where: { productId: row.id }, orderBy: { sortOrder: 'asc' } }),
      db.productDocument.findMany({ where: { productId: row.id }, orderBy: { sortOrder: 'asc' } }),
      db.productRelated.findMany({ where: { productId: row.id }, orderBy: { sortOrder: 'asc' } }),
      this.seo.forEntity(EntityType.PRODUCT, row.id),
    ]);
    const media = await this.media.resolveMany([row.heroImageMediaId, ...images.map((i: any) => i.mediaId), ...documents.map((d: any) => d.mediaId)]);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.shortDescription,
      contentHtml: row.contentHtml,
      tagline: row.tagline,
      heroImageMediaId: row.heroImageMediaId,
      heroImage: mediaOf(media, row.heroImageMediaId),
      brandId: row.brandId,
      brand: row.brand ?? null,
      categoryId: row.categoryId,
      category: row.category ?? null,
      extraCategoryIds: row.extraCategoryIds,
      countryCode: row.countryCode,
      countryName: row.countryName,
      originCity: row.originCity,
      isFeatured: row.isFeatured,
      inquiryEnabled: row.inquiryEnabled,
      partNumber: row.partNumber,
      sortOrder: row.sortOrder,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      version: row.version,
      images: images.map((i: any) => ({ mediaId: i.mediaId, media: mediaOf(media, i.mediaId), caption: i.caption, altOverride: i.altOverride })),
      specs: specs.map((s: any) => ({ groupName: s.groupName, label: s.label, value: s.value, unit: s.unit })),
      documents: documents.map((d: any) => ({ id: d.id, title: d.title, mediaId: d.mediaId, language: d.language, visibility: d.visibility, downloadCount: d.downloadCount, media: mediaOf(media, d.mediaId) })),
      relatedIds: related.map((r: any) => r.relatedProductId),
      seo: seo ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      warnings: [
        ...(row.status === 'PUBLISHED' && !row.heroImageMediaId ? [{ code: 'MISSING_IMAGE', message: 'Product has no hero image' }] : []),
        ...(images.some((i: any) => !media.get(i.mediaId)?.alt) ? [{ code: 'MEDIA_ALT_MISSING', message: 'A gallery image has no alt text' }] : []),
      ],
    };
  }

  async duplicate(sourceId: string, ctx: CrudContext) {
    const src = await this.getDto(sourceId);
    const { id: _id, slug: _s, status: _st, publishedAt: _p, scheduledAt: _sc, version: _v, createdAt: _c, updatedAt: _u, deletedAt: _d, seo: _seo, ...rest } = src as any;
    void [_id, _s, _st, _p, _sc, _v, _c, _u, _d, _seo];
    return this.create({
      ...rest,
      title: `Copy of ${src.title}`.slice(0, 160),
      images: rest.images?.map((x: any) => ({ mediaId: x.mediaId, caption: x.caption, altOverride: x.altOverride })),
      documents: rest.documents?.map((d: any) => ({ title: d.title, mediaId: d.mediaId, language: d.language })),
      relatedIds: rest.relatedIds,
    }, ctx);
  }
}

@ApiTags('admin-products')
@Controller('admin/products')
export class ProductsAdminController extends CrudAdminController {
  protected readonly createSchema = productInput;
  protected readonly updateSchema = productUpdate;
  constructor(readonly crud: ProductsService) {
    super();
  }

  @Patch(':id/feature')
  feature(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { isFeatured } = parse(z.object({ isFeatured: z.boolean() }).strict(), body);
    return this.crud.update(id, { isFeatured }, crudContext(req, user));
  }

  @Put(':id/images')
  images(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { images } = parse(z.object({ images: productInput.shape.images.unwrap() }).strict(), body);
    return this.crud.update(id, { images }, crudContext(req, user));
  }

  @Put(':id/specs')
  specs(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { specs } = parse(z.object({ specs: productInput.shape.specs.unwrap() }).strict(), body);
    return this.crud.update(id, { specs }, crudContext(req, user));
  }

  @Put(':id/documents')
  documents(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { documents } = parse(z.object({ documents: productInput.shape.documents.unwrap() }).strict(), body);
    return this.crud.update(id, { documents }, crudContext(req, user));
  }

  @Put(':id/related')
  related(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { relatedIds } = parse(z.object({ relatedIds: z.array(z.string().uuid()).max(8) }).strict(), body);
    return this.crud.update(id, { relatedIds }, crudContext(req, user));
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.crud.duplicate(id, crudContext(req, user));
  }
}

@ApiTags('public-products')
@Controller('public/products')
export class ProductsPublicController {
  constructor(private readonly reads: ProductsReadService) {}

  @Public()
  @Get()
  list(@Query() query: Record<string, string>) {
    const q = parse(
      z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(48).default(12),
          q: z.string().trim().min(2).max(80).optional(),
          category: z.string().max(96).optional(),
          brand: z.string().max(96).optional(),
          country: z.string().length(2).optional(),
          featured: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
          sort: z.enum(['order', 'title', '-title', '-publishedAt']).default('order'),
        })
        .strict(),
      query,
    );
    return this.reads.listPublic({ ...q, sort: q.sort });
  }

  @Public()
  @Get('search')
  async search(@Query() query: Record<string, string>) {
    const q = parse(z.object({ q: z.string().trim().min(2, 'q must be at least 2 characters').max(80), limit: z.coerce.number().int().min(1).max(10).default(8) }).strict(), query);
    return { data: await this.reads.search(q.q, q.limit) };
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.reads.detailPublic(slug);
  }

  @Public()
  @Get(':slug/documents/:documentId/download')
  async download(@Param('slug') slug: string, @Param('documentId') documentId: string, @Res() res: Response): Promise<void> {
    const url = await this.reads.documentUrl(slug, documentId);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  }
}
