import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { EntityType } from '@prisma/client';
import type { Request } from 'express';
import { Public } from '../common/decorators/access.decorators';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CrudAdminController, parse, crudContext } from '../common/content/crud.controller';
import { PublishableCrud } from '../common/content/content-crud';
import { SimpleCrud } from '../common/content/simple-crud';
import { assertMedia, LIVE } from '../common/content/refs';
import { plainText, sanitizeRichText } from '../common/utils/sanitize';
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
import { mediaOf, trimText } from '../catalogue/shared';
import { buildSeo } from '../catalogue/seo-public';
import { postCards, readingMinutes } from './posts.read';

// ---------------------------------------------------------------- posts

export const postInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().max(96).optional(),
    excerpt: z.string().trim().min(1).max(500),
    bodyHtml: z.string().min(1).max(200_000),
    coverMediaId: z.string().uuid().nullable().optional(),
    authorName: z.string().max(120).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    isFeatured: z.boolean().optional(),
    publishedAt: z.string().datetime().nullable().optional(),
    seo: z.any().optional(),
  })
  .strict();
export const postUpdate = postInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

@Injectable()
export class PostsService extends PublishableCrud<any> {
  protected readonly delegate = 'post';
  protected readonly entityName = 'post';
  protected readonly seoType: EntityType = EntityType.POST;
  protected readonly searchFields = ['title', 'excerpt'];

  constructor(prisma: PrismaService, audit: AuditService, revalidation: RevalidationService, seo: SeoService, refs: MediaRefService, redirects: RedirectsService, private readonly media: MediaService) {
    super(prisma, audit, revalidation, seo, refs, redirects);
  }

  protected include() {
    return { category: { select: { id: true, name: true, slug: true } }, tags: { include: { tag: true } } };
  }

  protected publicPath(slug: string): string {
    return `/news/${slug}`;
  }

  protected tags(row: any): TagSet {
    return { tags: ['posts', 'sitemap', ...(row.slug ? [`post:${row.slug}`] : [])], paths: ['/news', ...(row.slug ? [`/news/${row.slug}`] : [])] };
  }

  protected async mediaIndex(row: any) {
    return { refs: [{ field: 'coverMediaId', mediaId: row.coverMediaId }], html: [{ field: 'bodyHtml', html: row.bodyHtml }] };
  }

  protected async prepare(input: Record<string, unknown>) {
    const i = input as any;
    await assertMedia(this.prisma, [i.coverMediaId], ['IMAGE', 'SVG'], 'coverMediaId');
    if (i.categoryId) {
      const c = await this.prisma.client.postCategory.findFirst({ where: { id: i.categoryId } });
      if (!c) throw ApiError.validation([{ field: 'categoryId', message: 'Category does not exist' }]);
    }
    const data: Record<string, unknown> = {};
    for (const k of ['slug', 'coverMediaId', 'categoryId', 'isFeatured', 'authorName']) if (i[k] !== undefined) data[k] = i[k];
    if (i.title !== undefined) data.title = plainText(i.title);
    if (i.excerpt !== undefined) data.excerpt = plainText(i.excerpt);
    if (i.bodyHtml !== undefined) {
      data.bodyHtml = sanitizeRichText(i.bodyHtml);
      if (!String(data.bodyHtml).replace(/<[^>]+>/g, '').trim()) throw new ApiError(422, 'HTML_REJECTED', 'The article body is empty after cleanup');
      data.readingMinutes = readingMinutes(String(data.bodyHtml));
    }
    if (i.publishedAt !== undefined) data.publishedAt = i.publishedAt ? new Date(i.publishedAt) : null;
    return data;
  }

  protected async afterWrite(row: any, input: Record<string, unknown> | null): Promise<void> {
    const tags = (input as any)?.tags;
    if (tags === undefined) return;
    const db = this.prisma.client;
    await db.postTag.deleteMany({ where: { postId: row.id } });
    for (const name of [...new Set(tags as string[])]) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tag';
      const tag = await db.tag.upsert({ where: { slug }, create: { name, slug }, update: {} });
      await db.postTag.create({ data: { postId: row.id, tagId: tag.id } });
    }
  }

  protected async validatePublish(row: any): Promise<void> {
    if (!row.bodyHtml || !row.excerpt) throw ApiError.validation([{ field: 'bodyHtml', message: 'An article needs a body and an excerpt to publish' }]);
  }

  protected async dto(row: any) {
    const media = await this.media.resolveMany([row.coverMediaId]);
    const seo = await this.seo.forEntity(EntityType.POST, row.id);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      bodyHtml: row.bodyHtml,
      coverMediaId: row.coverMediaId,
      cover: mediaOf(media, row.coverMediaId),
      authorName: row.authorName,
      category: row.category ?? null,
      categoryId: row.categoryId,
      tags: (row.tags ?? []).map((t: any) => ({ slug: t.tag.slug, name: t.tag.name })),
      readingMinutes: row.readingMinutes,
      isFeatured: row.isFeatured,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      version: row.version,
      seo: seo ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      warnings: row.status === 'PUBLISHED' && !row.coverMediaId ? [{ code: 'MISSING_IMAGE', message: 'Article has no cover image' }] : [],
    };
  }

  async listPublic(q: { page: number; pageSize: number; category?: string; tag?: string; q?: string; sort: string }) {
    const where: Record<string, unknown> = { ...LIVE() };
    if (q.category) where.category = { slug: q.category.toLowerCase() };
    if (q.tag) where.tags = { some: { tag: { slug: q.tag.toLowerCase() } } };
    if (q.q) where.OR = [{ title: { contains: q.q, mode: 'insensitive' } }, { excerpt: { contains: q.q, mode: 'insensitive' } }];
    const order = q.sort === 'publishedAt' ? { publishedAt: 'asc' as const } : { publishedAt: 'desc' as const };
    const [rows, total] = await Promise.all([
      this.prisma.client.post.findMany({ where, include: { category: true }, orderBy: order, ...skipTake(q.page, q.pageSize) }),
      this.prisma.client.post.count({ where }),
    ]);
    return paged(await postCards(this.prisma, this.media, rows), total, q.page, q.pageSize);
  }

  async detailPublic(slug: string) {
    const row = await this.prisma.client.post.findFirst({ where: { slug: slug.toLowerCase(), ...LIVE() }, include: { category: true, tags: { include: { tag: true } } } });
    if (!row) throw ApiError.notFound('Post');
    const [prev, next, related] = await Promise.all([
      this.prisma.client.post.findFirst({ where: { ...LIVE(), publishedAt: { lt: row.publishedAt ?? new Date() } }, orderBy: { publishedAt: 'desc' }, include: { category: true } }),
      this.prisma.client.post.findFirst({ where: { ...LIVE(), publishedAt: { gt: row.publishedAt ?? new Date() } }, orderBy: { publishedAt: 'asc' }, include: { category: true } }),
      this.prisma.client.post.findMany({ where: { ...LIVE(), id: { not: row.id }, ...(row.categoryId ? { categoryId: row.categoryId } : {}) }, orderBy: { publishedAt: 'desc' }, take: 3, include: { category: true } }),
    ]);
    const seoRow = await this.seo.forEntity(EntityType.POST, row.id);
    const media = await this.media.resolveMany([row.coverMediaId]);
    const seo = await buildSeo(this.prisma, {
      seo: seoRow as any,
      fallbackTitle: row.title,
      fallbackDescription: trimText(row.excerpt, 160),
      path: `/news/${row.slug}`,
      type: 'article',
      image: mediaOf(media, row.coverMediaId),
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'Article', headline: row.title, description: row.excerpt, datePublished: row.publishedAt?.toISOString(), dateModified: row.updatedAt.toISOString(), author: row.authorName ? { '@type': 'Person', name: row.authorName } : undefined, image: mediaOf(media, row.coverMediaId)?.url }],
    });
    const [prevCard] = prev ? await postCards(this.prisma, this.media, [prev]) : [null];
    const [nextCard] = next ? await postCards(this.prisma, this.media, [next]) : [null];
    const [card] = await postCards(this.prisma, this.media, [row]);
    return {
      ...card,
      bodyHtml: row.bodyHtml,
      tags: (row.tags ?? []).map((t: any) => ({ slug: t.tag.slug, name: t.tag.name })),
      prev: prevCard,
      next: nextCard,
      related: await postCards(this.prisma, this.media, related),
      updatedAt: row.updatedAt.toISOString(),
      seo,
    };
  }
}

@ApiTags('admin-posts')
@Controller('admin/posts')
export class PostsAdminController extends CrudAdminController {
  protected readonly createSchema = postInput;
  protected readonly updateSchema = postUpdate;
  constructor(readonly crud: PostsService) {
    super();
  }
}

@ApiTags('public-posts')
@Controller('public/posts')
export class PostsPublicController {
  constructor(private readonly posts: PostsService) {}

  @Public()
  @Get()
  list(@Query() query: Record<string, string>) {
    const q = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(24).default(12),
        category: z.string().max(96).optional(),
        tag: z.string().max(60).optional(),
        q: z.string().trim().min(2).max(80).optional(),
        sort: z.enum(['-publishedAt', 'publishedAt']).default('-publishedAt'),
      }).strict(),
      query,
    );
    return this.posts.listPublic(q);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.posts.detailPublic(slug);
  }
}

// ---------------------------------------------------------------- post categories and tags

export const postCategoryInput = z.object({ name: z.string().trim().min(1).max(80), slug: z.string().max(96).optional(), description: z.string().max(2000).nullable().optional(), sortOrder: z.number().int().optional() }).strict();

@ApiTags('admin-post-categories')
@Controller('admin/post-categories')
export class PostCategoriesAdminController {
  private readonly crud: SimpleCrud;
  constructor(prisma: PrismaService) {
    this.crud = new SimpleCrud(prisma, 'postCategory', postCategoryInput, postCategoryInput.partial());
  }
  @Get()
  async list() {
    return { data: await this.crud.list() };
  }
  @Post()
  create(@Body() body: unknown) {
    return this.crud.create(body);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.crud.update(id, body);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.crud.remove(id);
  }
}

@ApiTags('public-post-categories')
@Controller('public/post-categories')
export class PostCategoriesPublicController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get()
  async list() {
    return { data: await this.prisma.client.postCategory.findMany({ where: {}, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }) };
  }
}

@ApiTags('admin-tags')
@Controller('admin/tags')
export class TagsAdminController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list() {
    return { data: await this.prisma.client.tag.findMany({ orderBy: { name: 'asc' } }) };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.prisma.client.tag.delete({ where: { id } });
  }
}

// ---------------------------------------------------------------- testimonials

export const testimonialInput = z
  .object({
    quote: z.string().trim().min(1).max(1000),
    personName: z.string().trim().min(1).max(120),
    personRole: z.string().max(120).nullable().optional(),
    companyName: z.string().max(160).nullable().optional(),
    photoMediaId: z.string().uuid().nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();
export const testimonialUpdate = testimonialInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

@Injectable()
export class TestimonialsService extends PublishableCrud<any> {
  protected readonly delegate = 'testimonial';
  protected readonly entityName = 'testimonial';
  protected readonly hasSlug = false;
  protected readonly searchFields = ['personName', 'quote'];
  constructor(prisma: PrismaService, audit: AuditService, revalidation: RevalidationService, seo: SeoService, refs: MediaRefService, redirects: RedirectsService, private readonly media: MediaService) {
    super(prisma, audit, revalidation, seo, refs, redirects);
  }
  protected tags(): TagSet {
    return { tags: ['testimonials', 'page:home'], paths: [] };
  }
  protected async mediaIndex(row: any) {
    return { refs: [{ field: 'photoMediaId', mediaId: row.photoMediaId }], html: [] };
  }
  protected async prepare(input: Record<string, unknown>) {
    const i = input as any;
    await assertMedia(this.prisma, [i.photoMediaId], ['IMAGE', 'SVG'], 'photoMediaId');
    const data: Record<string, unknown> = {};
    for (const k of ['personRole', 'companyName', 'photoMediaId', 'rating', 'sortOrder']) if (i[k] !== undefined) data[k] = i[k];
    if (i.quote !== undefined) data.quote = plainText(i.quote);
    if (i.personName !== undefined) data.personName = plainText(i.personName);
    return data;
  }
  protected async dto(row: any) {
    const media = await this.media.resolveMany([row.photoMediaId]);
    return { id: row.id, quote: row.quote, personName: row.personName, personRole: row.personRole, companyName: row.companyName, photoMediaId: row.photoMediaId, photo: mediaOf(media, row.photoMediaId), rating: row.rating, sortOrder: row.sortOrder, status: row.status, version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null, warnings: [] };
  }
}

@ApiTags('admin-testimonials')
@Controller('admin/testimonials')
export class TestimonialsAdminController extends CrudAdminController {
  protected readonly createSchema = testimonialInput;
  protected readonly updateSchema = testimonialUpdate;
  constructor(readonly crud: TestimonialsService) {
    super();
  }
}

@ApiTags('public-testimonials')
@Controller('public/testimonials')
export class TestimonialsPublicController {
  constructor(private readonly prisma: PrismaService, private readonly media: MediaService) {}
  @Public()
  @Get()
  async list(@Query('limit') limit?: string) {
    const rows = await this.prisma.client.testimonial.findMany({ where: LIVE(), orderBy: [{ sortOrder: 'asc' }], take: Math.min(Number(limit) || 20, 50) });
    const media = await this.media.resolveMany(rows.map((r) => r.photoMediaId));
    return { data: rows.map((r) => ({ id: r.id, quote: r.quote, personName: r.personName, personRole: r.personRole, companyName: r.companyName, photo: mediaOf(media, r.photoMediaId), rating: r.rating })) };
  }
}

// ---------------------------------------------------------------- FAQ

export const faqGroupInput = z.object({ title: z.string().trim().min(1).max(160), slug: z.string().max(96).optional(), sortOrder: z.number().int().optional() }).strict();
export const faqGroupUpdate = faqGroupInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();
export const faqInput = z.object({ question: z.string().trim().min(1).max(300), answerHtml: z.string().min(1).max(20_000), sortOrder: z.number().int().optional(), status: z.enum(['DRAFT', 'PUBLISHED']).optional() }).strict();

@Injectable()
export class FaqService extends PublishableCrud<any> {
  protected readonly delegate = 'faqGroup';
  protected readonly entityName = 'faq-group';
  protected readonly searchFields = ['title'];
  constructor(prisma: PrismaService, audit: AuditService, revalidation: RevalidationService, seo: SeoService, refs: MediaRefService, redirects: RedirectsService) {
    super(prisma, audit, revalidation, seo, refs, redirects);
  }
  protected include() {
    return { faqs: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } };
  }
  protected tags(): TagSet {
    return { tags: ['faqs', 'pages'], paths: [] };
  }
  protected async prepare(input: Record<string, unknown>) {
    const i = input as any;
    const data: Record<string, unknown> = {};
    for (const k of ['slug', 'sortOrder']) if (i[k] !== undefined) data[k] = i[k];
    if (i.title !== undefined) data.title = plainText(i.title);
    return data;
  }
  protected async dto(row: any) {
    return { id: row.id, title: row.title, slug: row.slug, sortOrder: row.sortOrder, status: row.status, version: row.version, faqs: (row.faqs ?? []).map((f: any) => ({ id: f.id, question: f.question, answerHtml: f.answerHtml, sortOrder: f.sortOrder, status: f.status })), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null, warnings: [] };
  }
  async publicList(group?: string) {
    const rows = await this.prisma.client.faqGroup.findMany({ where: { status: 'PUBLISHED', deletedAt: null, ...(group ? { slug: group.toLowerCase() } : {}) }, orderBy: [{ sortOrder: 'asc' }], include: { faqs: { where: { status: 'PUBLISHED', deletedAt: null }, orderBy: { sortOrder: 'asc' } } } });
    return {
      data: rows.map((g: any) => ({
        id: g.id,
        slug: g.slug,
        title: g.title,
        items: g.faqs.map((f: any) => ({ id: f.id, question: f.question, answerHtml: f.answerHtml })),
        jsonLd: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faqs.map((f: any) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answerHtml.replace(/<[^>]+>/g, ' ').trim() } })) },
      })),
    };
  }
}

@ApiTags('admin-faq-groups')
@Controller('admin/faq-groups')
export class FaqAdminController extends CrudAdminController {
  protected readonly createSchema = faqGroupInput;
  protected readonly updateSchema = faqGroupUpdate;
  private readonly items: SimpleCrud;
  constructor(readonly crud: FaqService, prisma: PrismaService) {
    super();
    this.items = new SimpleCrud(prisma, 'faq', faqInput, faqInput.partial(), [{ sortOrder: 'asc' }]);
  }
  @Post(':id/faqs')
  async addItem(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.crud.findOrFail(id);
    const row = await this.items.create(body, { groupId: id });
    void user;
    void crudContext;
    void req;
    return row;
  }
  @Patch(':id/faqs/:faqId')
  async patchItem(@Param('id') id: string, @Param('faqId') faqId: string, @Body() body: unknown) {
    const current = await this.items.get(faqId);
    if (current.groupId !== id) throw ApiError.notFound('FAQ');
    return this.items.update(faqId, body);
  }
  @Delete(':id/faqs/:faqId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(@Param('id') id: string, @Param('faqId') faqId: string): Promise<void> {
    const current = await this.items.get(faqId);
    if (current.groupId !== id) throw ApiError.notFound('FAQ');
    await this.items.remove(faqId);
  }
  @Patch(':id/faqs/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderItems(@Param('id') id: string, @Body() body: unknown): Promise<void> {
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).strict(), body);
    void id;
    await this.items.reorder(ids);
  }
}

@ApiTags('public-faqs')
@Controller('public/faqs')
export class FaqPublicController {
  constructor(private readonly faqs: FaqService) {}
  @Public()
  @Get()
  list(@Query('group') group?: string) {
    return this.faqs.publicList(group);
  }
}

export { Put, Patch, Req };
