import { Injectable } from '@nestjs/common';
import { BlockType, EntityType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PublishableCrud, CrudContext } from '../common/content/content-crud';
import { assertMedia, LIVE } from '../common/content/refs';
import { ApiError } from '../common/utils/errors';
import { SLUG_PATTERN } from '../common/utils/slug';
import { sanitizeRichText } from '../common/utils/sanitize';
import { TagSet } from '../common/constants/revalidation-map';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { SeoService } from '../seo/seo.service';
import { MediaRefService } from '../media/media.refs';
import { RedirectsService } from '../redirects/redirects.service';
import { MediaService } from '../media/media.service';
import { mediaOf } from '../catalogue/shared';
import { BrandsService } from '../catalogue/brands';
import { ProductsReadService } from '../catalogue/products.read';
import { VideosReadService } from '../catalogue/videos.read';
import { ServicesService } from '../catalogue/services';
import { SubsidiariesService } from '../catalogue/subsidiaries';
import { blockDefaults, blockSchemas, BLOCK_TYPES } from './block-schemas';
import { BlocksResolver } from './blocks.resolver';
import { ApiError as Err } from '../common/utils/errors';

export const pageInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().max(96).optional(),
    template: z.enum(['HOME', 'ABOUT', 'DEFAULT']).optional(),
    heroTitle: z.string().max(200).nullable().optional(),
    heroSubtitle: z.string().max(500).nullable().optional(),
    heroImageMediaId: z.string().uuid().nullable().optional(),
    showInSitemap: z.boolean().optional(),
    seo: z.any().optional(),
    blocks: z.array(z.any()).max(60).optional(),
  })
  .strict();
export const pageUpdate = pageInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

export const blockBody = z.object({
  type: z.nativeEnum(BlockType),
  data: z.record(z.unknown()).optional(),
  anchorId: z.string().max(60).regex(/^[a-z0-9-]+$/).nullable().optional(),
  navLabel: z.string().max(60).nullable().optional(),
  showInTabNav: z.boolean().optional(),
  visible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
}).strict();

/** Validates one block against its type schema (422 BLOCK_INVALID with zod issue paths). */
export function validateBlockData(type: BlockType, data: unknown): Record<string, unknown> {
  const schema = blockSchemas[type];
  if (!schema) throw new ApiError(422, 'BLOCK_INVALID', `Unknown block type ${type}`);
  const parsed = schema.safeParse(data ?? blockDefaults[type] ?? {});
  if (!parsed.success) {
    throw new ApiError(
      422,
      'BLOCK_INVALID',
      'Block data is invalid',
      parsed.error.issues.map((i) => ({ field: `data.${i.path.join('.')}`, message: i.message, code: i.code })),
    );
  }
  const out = parsed.data as Record<string, unknown>;
  for (const key of ['bodyHtml', 'visionHtml', 'html']) {
    if (typeof out[key] === 'string') out[key] = sanitizeRichText(out[key] as string);
  }
  return out;
}

@Injectable()
export class PagesService extends PublishableCrud<any> {
  protected readonly delegate = 'page';
  protected readonly entityName = 'page';
  protected readonly seoType: EntityType = EntityType.PAGE;
  protected readonly searchFields = ['title', 'slug'];
  protected readonly ordered = false;

  constructor(
    prisma: PrismaService,
    audit: AuditService,
    revalidation: RevalidationService,
    seo: SeoService,
    refs: MediaRefService,
    redirects: RedirectsService,
    private readonly media: MediaService,
    private readonly resolver: BlocksResolver,
  ) {
    super(prisma, audit, revalidation, seo, refs, redirects);
  }

  protected publicPath(slug: string): string {
    return slug === 'home' ? '/' : `/${slug}`;
  }

  protected tags(row: any): TagSet {
    const slug = row.slug as string | undefined;
    return { tags: ['pages', 'sitemap', ...(slug ? [`page:${slug}`] : [])], paths: slug ? [this.publicPath(slug)] : [] };
  }

  protected async mediaIndex(row: any) {
    const blocks = await this.prisma.client.pageBlock.findMany({ where: { pageId: row.id } });
    const blockRefs = blocks.flatMap((b) => {
      const d = b.data as Record<string, any>;
      const ids: Array<{ field: string; mediaId: string | null | undefined }> = [];
      if (d.imageMediaId) ids.push({ field: 'block.image', mediaId: d.imageMediaId });
      if (d.backgroundMediaId) ids.push({ field: 'block.background', mediaId: d.backgroundMediaId });
      for (const img of d.images ?? []) ids.push({ field: 'block.gallery', mediaId: img.mediaId });
      return ids;
    });
    return { refs: [{ field: 'heroImageMediaId', mediaId: row.heroImageMediaId }, ...blockRefs], html: [{ field: 'heroSubtitle', html: null }] };
  }

  protected async prepare(input: Record<string, unknown>, existing: any) {
    const i = input as any;
    await assertMedia(this.prisma, [i.heroImageMediaId], ['IMAGE', 'SVG'], 'heroImageMediaId');
    if (existing?.isSystem && i.slug !== undefined && i.slug !== existing.slug) {
      throw new ApiError(409, 'SYSTEM_RESOURCE_PROTECTED', 'The slug of a system page cannot be changed');
    }
    if (i.slug !== undefined && SLUG_PATTERN.test(i.slug) === false) {
      throw ApiError.validation([{ field: 'slug', message: 'Invalid slug' }]);
    }
    const data: Record<string, unknown> = {};
    for (const k of ['title', 'template', 'heroTitle', 'heroSubtitle', 'heroImageMediaId', 'showInSitemap']) if (i[k] !== undefined) data[k] = i[k];
    if (i.slug !== undefined && !existing?.isSystem) data.slug = i.slug;
    if (!existing && i.slug) data.slug = i.slug;
    return data;
  }

  /** Blocks supplied on create are inserted in order; a RICH_TEXT block is the default for simple pages. */
  protected async afterWrite(row: any, input: Record<string, unknown> | null, ctx: CrudContext): Promise<void> {
    const blocks = (input as any)?.blocks as Array<z.infer<typeof blockBody>> | undefined;
    if (blocks === undefined) return;
    await this.replaceBlocks(row.id, blocks.map((b, n) => ({ ...b, sortOrder: n })));
    void ctx;
  }

  async softDelete(id: string, ctx: CrudContext): Promise<void> {
    const row = await this.findOrFail(id);
    if (row.isSystem) throw new ApiError(409, 'SYSTEM_RESOURCE_PROTECTED', 'System pages cannot be deleted');
    return super.softDelete(id, ctx);
  }

  protected async validatePublish(row: any): Promise<void> {
    const count = await this.prisma.client.pageBlock.count({ where: { pageId: row.id, visible: true } });
    if (!count && row.slug !== 'home' && row.slug !== 'about') {
      throw ApiError.validation([{ field: 'blocks', message: 'A page needs at least one visible block to publish' }]);
    }
  }

  protected async dto(row: any) {
    const blocks = await this.prisma.client.pageBlock.findMany({ where: { pageId: row.id }, orderBy: { sortOrder: 'asc' } });
    const seo = await this.seo.forEntity(EntityType.PAGE, row.id);
    const media = await this.media.resolveMany([row.heroImageMediaId]);
    return {
      id: row.id,
      key: row.key,
      slug: row.slug,
      title: row.title,
      isSystem: row.isSystem,
      template: row.template,
      heroTitle: row.heroTitle,
      heroSubtitle: row.heroSubtitle,
      heroImageMediaId: row.heroImageMediaId,
      heroImage: mediaOf(media, row.heroImageMediaId),
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      showInSitemap: row.showInSitemap,
      version: row.version,
      blocks: blocks.map((b) => ({ id: b.id, type: b.type, anchorId: b.anchorId, navLabel: b.navLabel, showInTabNav: b.showInTabNav, visible: b.visible, sortOrder: b.sortOrder, data: b.data })),
      seo: seo ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      warnings: blocks
        .filter((b) => b.visible && b.type === 'FEATURED_PRODUCTS')
        .map(() => ({ code: 'BLOCK_REFERENCES', message: 'Check that referenced products are published' }))
        .slice(0, 0),
    };
  }

  // ------------------------------------------------------------ blocks

  async replaceBlocks(pageId: string, blocks: Array<z.infer<typeof blockBody> & { sortOrder?: number }>) {
    const rows = blocks.map((b, n) => {
      const type = b.type;
      const data = validateBlockData(type, b.data);
      return {
        pageId,
        type,
        anchorId: b.anchorId ?? null,
        navLabel: b.navLabel ?? null,
        showInTabNav: b.showInTabNav ?? false,
        visible: b.visible ?? true,
        sortOrder: n,
        data: data as Prisma.InputJsonValue,
      };
    });
    const anchors = rows.map((r) => r.anchorId).filter((x): x is string => !!x);
    if (new Set(anchors).size !== anchors.length) throw ApiError.validation([{ field: 'anchorId', message: 'Anchor ids must be unique per page' }]);
    await this.prisma.client.$transaction([
      this.prisma.client.pageBlock.deleteMany({ where: { pageId } }),
      this.prisma.client.pageBlock.createMany({ data: rows }),
    ]);
  }

  async listBlocks(pageId: string) {
    await this.findOrFail(pageId);
    return { data: await this.prisma.client.pageBlock.findMany({ where: { pageId }, orderBy: { sortOrder: 'asc' } }) };
  }

  async addBlock(pageId: string, body: z.infer<typeof blockBody>) {
    await this.findOrFail(pageId);
    const count = await this.prisma.client.pageBlock.count({ where: { pageId } });
    const data = validateBlockData(body.type, body.data);
    return this.prisma.client.pageBlock.create({
      data: {
        pageId,
        type: body.type,
        anchorId: body.anchorId ?? null,
        navLabel: body.navLabel ?? null,
        showInTabNav: body.showInTabNav ?? false,
        visible: body.visible ?? true,
        sortOrder: body.sortOrder ?? count,
        data: data as Prisma.InputJsonValue,
      },
    });
  }

  async updateBlock(pageId: string, blockId: string, body: Partial<z.infer<typeof blockBody>>) {
    const current = await this.prisma.client.pageBlock.findFirst({ where: { id: blockId, pageId } });
    if (!current) throw ApiError.notFound('Block');
    const type = (body.type ?? current.type) as BlockType;
    const data = body.data !== undefined || body.type !== undefined ? validateBlockData(type, body.data ?? current.data) : undefined;
    return this.prisma.client.pageBlock.update({
      where: { id: blockId },
      data: {
        type,
        ...(data ? { data: data as Prisma.InputJsonValue } : {}),
        ...(body.anchorId !== undefined ? { anchorId: body.anchorId } : {}),
        ...(body.navLabel !== undefined ? { navLabel: body.navLabel } : {}),
        ...(body.showInTabNav !== undefined ? { showInTabNav: body.showInTabNav } : {}),
        ...(body.visible !== undefined ? { visible: body.visible } : {}),
      },
    });
  }

  async deleteBlock(pageId: string, blockId: string): Promise<void> {
    const r = await this.prisma.client.pageBlock.deleteMany({ where: { id: blockId, pageId } });
    if (!r.count) throw ApiError.notFound('Block');
  }

  async reorderBlocks(pageId: string, ids: string[]) {
    const rows = await this.prisma.client.pageBlock.findMany({ where: { pageId }, select: { id: true } });
    if (rows.length !== ids.length || new Set(ids).size !== ids.length || rows.some((r) => !ids.includes(r.id))) {
      throw ApiError.validation([{ field: 'ids', message: 'ids must list every block of the page exactly once' }]);
    }
    await this.prisma.client.$transaction(ids.map((id, i) => this.prisma.client.pageBlock.update({ where: { id }, data: { sortOrder: i } })));
  }

  async duplicateBlock(pageId: string, blockId: string) {
    const src = await this.prisma.client.pageBlock.findFirst({ where: { id: blockId, pageId } });
    if (!src) throw ApiError.notFound('Block');
    const count = await this.prisma.client.pageBlock.count({ where: { pageId } });
    return this.prisma.client.pageBlock.create({ data: { pageId, type: src.type, data: src.data as Prisma.InputJsonValue, navLabel: null, anchorId: null, showInTabNav: false, visible: src.visible, sortOrder: count } });
  }

  static blockTypes() {
    return {
      data: BLOCK_TYPES.map((type) => ({
        type,
        label: type.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
        jsonSchema: (zodToJsonSchema as (s: unknown, o: unknown) => unknown)(blockSchemas[type], { $refStrategy: 'none' }),
        defaultData: blockDefaults[type] ?? {},
      })),
    };
  }

  // ------------------------------------------------------------ public

  /** Public page: blocks resolved, visible only, tabNav built from blocks and subsidiaries. */
  async publicPage(slug: string) {
    const key = slug.toLowerCase();
    const page = await this.prisma.client.page.findFirst({ where: { slug: key, ...LIVE() } });
    if (!page) throw ApiError.notFound('Page');
    const blocks = await this.prisma.client.pageBlock.findMany({ where: { pageId: page.id, visible: true }, orderBy: { sortOrder: 'asc' } });
    const resolved: any[] = [];
    const tabNav: Array<{ label: string; anchorId: string }> = [];
    for (const b of blocks) {
      const r = await this.resolver.resolve(b);
      if (b.showInTabNav && b.navLabel && b.anchorId) tabNav.push({ label: b.navLabel, anchorId: b.anchorId });
      if (b.type === 'SUBSIDIARIES') for (const s of (r as any).subsidiaries ?? []) tabNav.push({ label: s.name, anchorId: s.anchorId });
      resolved.push(r);
    }
    const seoRow = await this.seo.forEntity(EntityType.PAGE, page.id);
    const media = await this.media.resolveMany([page.heroImageMediaId]);
    const { buildSeo } = await import('../catalogue/seo-public');
    const seo = await buildSeo(this.prisma, {
      seo: seoRow as any,
      fallbackTitle: page.title,
      fallbackDescription: page.heroSubtitle ?? null,
      path: this.publicPath(page.slug),
      type: 'website',
      image: mediaOf(media, page.heroImageMediaId),
      jsonLd: [],
    });
    return {
      id: page.id,
      slug: page.slug,
      key: page.key,
      title: page.title,
      template: page.template,
      heroTitle: page.heroTitle,
      heroSubtitle: page.heroSubtitle,
      heroImage: mediaOf(media, page.heroImageMediaId),
      blocks: resolved,
      tabNav,
      updatedAt: page.updatedAt.toISOString(),
      seo,
    };
  }

  async publicList() {
    const rows = await this.prisma.client.page.findMany({ where: { ...LIVE(), isSystem: false }, orderBy: { title: 'asc' } });
    return { data: rows.map((r) => ({ slug: r.slug, title: r.title, updatedAt: r.updatedAt.toISOString() })) };
  }

  /** Converts a block to an error the admin UI can show; kept for symmetry with BLOCK_INVALID. */
  static invalid(message: string) {
    return new Err(422, 'BLOCK_INVALID', message);
  }
}

export { BrandsService, ProductsReadService, VideosReadService, ServicesService, SubsidiariesService };
