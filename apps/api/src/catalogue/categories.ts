import { Controller, Get, Injectable, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { EntityType } from '@prisma/client';
import { Public } from '../common/decorators/access.decorators';
import { CrudAdminController } from '../common/content/crud.controller';
import { PublishableCrud } from '../common/content/content-crud';
import { assertLive, assertMedia, LIVE } from '../common/content/refs';
import { plainText, sanitizeRichText } from '../common/utils/sanitize';
import { ApiError } from '../common/utils/errors';
import { TagSet } from '../common/constants/revalidation-map';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { SeoService } from '../seo/seo.service';
import { MediaRefService } from '../media/media.refs';
import { RedirectsService } from '../redirects/redirects.service';
import { MediaService } from '../media/media.service';
import { mediaOf } from './shared';
import { buildSeo } from './seo-public';

const id = z.string().uuid();
export const categoryInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().max(96).optional(),
    description: z.string().max(5000).nullable().optional(),
    imageMediaId: id.nullable().optional(),
    parentId: id.nullable().optional(),
    sortOrder: z.number().int().optional(),
    seo: z.any().optional(),
  })
  .strict();
export const categoryUpdate = categoryInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

@Injectable()
export class CategoriesService extends PublishableCrud<any> {
  protected readonly delegate = 'productCategory';
  protected readonly entityName = 'product-category';
  protected readonly seoType: EntityType = EntityType.PRODUCT_CATEGORY;
  protected readonly searchFields = ['name'];

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
    return `/products?category=${slug}`;
  }

  protected tags(row: any): TagSet {
    return { tags: ['categories', 'products', 'sitemap'], paths: ['/products'] } as TagSet;
  }

  protected async mediaIndex(row: any) {
    return { refs: [{ field: 'imageMediaId', mediaId: row.imageMediaId }], html: [] };
  }

  protected async prepare(input: Record<string, unknown>, existing: any) {
    const i = input as any;
    await assertMedia(this.prisma, [i.imageMediaId], ['IMAGE', 'SVG'], 'imageMediaId');
    if (i.parentId) {
      if (existing && i.parentId === existing.id) throw ApiError.validation([{ field: 'parentId', message: 'A category cannot be its own parent' }]);
      await assertLive(this.prisma, 'productCategory', i.parentId, 'parentId');
      const parent = await this.prisma.client.productCategory.findFirst({ where: { id: i.parentId } });
      if (parent?.parentId) throw ApiError.validation([{ field: 'parentId', message: 'Categories support one level of nesting only' }]);
    }
    const data: Record<string, unknown> = {};
    for (const k of ['name', 'slug', 'imageMediaId', 'parentId', 'sortOrder']) if (i[k] !== undefined) data[k] = i[k];
    if (i.name !== undefined) data.name = plainText(i.name);
    if (i.description !== undefined) data.description = i.description ? sanitizeRichText(i.description) : null;
    return data;
  }

  protected async dto(row: any) {
    const seo = await this.seo.forEntity(EntityType.PRODUCT_CATEGORY, row.id);
    const media = await this.media.resolveMany([row.imageMediaId]);
    const productCount = await this.prisma.client.product.count({ where: { categoryId: row.id, deletedAt: null } });
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageMediaId: row.imageMediaId,
      image: mediaOf(media, row.imageMediaId),
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      version: row.version,
      productCount,
      seo: seo ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  /** Public tree of live categories with live product counts. */
  async tree() {
    const rows = await this.prisma.client.productCategory.findMany({ where: LIVE(), orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const counts = await this.prisma.client.product.groupBy({ by: ['categoryId'], where: LIVE(), _count: { _all: true } });
    const countOf = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    const media = await this.media.resolveMany(rows.map((r) => r.imageMediaId));
    const cards = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      image: mediaOf(media, r.imageMediaId),
      parentSlug: r.parentId ? rows.find((p) => p.id === r.parentId)?.slug ?? null : null,
      productCount: countOf.get(r.id) ?? 0,
      parentId: r.parentId,
      childIds: rows.filter((c) => c.parentId === r.id).map((c) => c.id),
    }));
    return { data: cards.filter((c) => !c.parentId).map(({ parentId: _p, ...c }) => ({ ...c, children: cards.filter((x) => x.parentId === c.id).map(({ parentId: _q, childIds: _cc, ...x }) => x) })) };
  }

  async detailPublic(slug: string) {
    const row = await this.prisma.client.productCategory.findFirst({ where: { slug: slug.toLowerCase(), ...LIVE() } });
    if (!row) throw ApiError.notFound('Category');
    const seoRow = await this.seo.forEntity(EntityType.PRODUCT_CATEGORY, row.id);
    const media = await this.media.resolveMany([row.imageMediaId]);
    const productCount = await this.prisma.client.product.count({ where: { ...LIVE(), categoryId: row.id } });
    const seo = await buildSeo(this.prisma, {
      seo: seoRow as any,
      fallbackTitle: row.name,
      fallbackDescription: row.description ? row.description.replace(/<[^>]+>/g, ' ').slice(0, 160) : null,
      path: `/products/category/${row.slug}`,
      type: 'website',
      image: mediaOf(media, row.imageMediaId),
      jsonLd: [],
    });
    return { id: row.id, slug: row.slug, name: row.name, description: row.description, image: mediaOf(media, row.imageMediaId), parentSlug: null, productCount, seo };
  }
}

@ApiTags('admin-categories')
@Controller('admin/product-categories')
export class CategoriesAdminController extends CrudAdminController {
  protected readonly createSchema = categoryInput;
  protected readonly updateSchema = categoryUpdate;
  constructor(readonly crud: CategoriesService) {
    super();
  }
}

@ApiTags('public-categories')
@Controller('public/product-categories')
export class CategoriesPublicController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  tree() {
    return this.categories.tree();
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.categories.detailPublic(slug);
  }
}

