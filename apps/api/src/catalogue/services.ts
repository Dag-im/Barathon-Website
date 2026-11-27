import { Body, Controller, Get, Injectable, Param, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { EntityType } from '@prisma/client';
import type { Request } from 'express';
import { Public } from '../common/decorators/access.decorators';
import { CrudAdminController, parse, crudContext } from '../common/content/crud.controller';
import { PublishableCrud } from '../common/content/content-crud';
import { assertMedia, LIVE } from '../common/content/refs';
import { plainText, sanitizeRichText } from '../common/utils/sanitize';
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
import { mediaOf, trimText } from './shared';
import { buildSeo } from './seo-public';

const feature = z.object({ title: z.string().min(1).max(200), description: z.string().max(500).nullable().optional() }).strict();
export const serviceInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    slug: z.string().max(96).optional(),
    shortDescription: z.string().trim().min(1).max(600),
    bodyHtml: z.string().max(100_000).nullable().optional(),
    imageMediaId: z.string().uuid().nullable().optional(),
    iconName: z.string().max(40).nullable().optional(),
    ctaLabel: z.string().max(60).nullable().optional(),
    ctaHref: z.string().max(300).nullable().optional(),
    sortOrder: z.number().int().optional(),
    features: z.array(feature).max(50).optional(),
    seo: z.any().optional(),
  })
  .strict();
export const serviceUpdate = serviceInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

@Injectable()
export class ServicesService extends PublishableCrud<any> {
  protected readonly delegate = 'service';
  protected readonly entityName = 'service';
  protected readonly seoType: EntityType = EntityType.SERVICE;
  protected readonly searchFields = ['title', 'shortDescription'];

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
    return `/services/${slug}`;
  }

  protected tags(row: any): TagSet {
    return { tags: ['services', 'sitemap', 'page:home', ...(row.slug ? [`service:${row.slug}`] : [])], paths: ['/services', ...(row.slug ? [`/services/${row.slug}`] : [])] };
  }

  protected async mediaIndex(row: any) {
    return { refs: [{ field: 'imageMediaId', mediaId: row.imageMediaId }], html: [{ field: 'bodyHtml', html: row.bodyHtml }] };
  }

  protected async prepare(input: Record<string, unknown>) {
    const i = input as any;
    await assertMedia(this.prisma, [i.imageMediaId], ['IMAGE', 'SVG', 'ICON'], 'imageMediaId');
    const data: Record<string, unknown> = {};
    for (const k of ['slug', 'imageMediaId', 'iconName', 'ctaHref', 'sortOrder']) if (i[k] !== undefined) data[k] = i[k];
    if (i.title !== undefined) data.title = plainText(i.title);
    if (i.shortDescription !== undefined) data.shortDescription = plainText(i.shortDescription);
    if (i.ctaLabel !== undefined) data.ctaLabel = i.ctaLabel ? plainText(i.ctaLabel) : null;
    if (i.bodyHtml !== undefined) data.bodyHtml = i.bodyHtml ? sanitizeRichText(i.bodyHtml) : null;
    return data;
  }

  protected async afterWrite(row: any, input: Record<string, unknown> | null): Promise<void> {
    const features = (input as any)?.features;
    if (features === undefined) return;
    const db = this.prisma.client;
    await db.$transaction([
      db.serviceFeature.deleteMany({ where: { serviceId: row.id } }),
      db.serviceFeature.createMany({ data: features.map((f: any, n: number) => ({ serviceId: row.id, title: plainText(f.title), description: f.description ? plainText(f.description) : null, sortOrder: n })) }),
    ]);
  }

  protected async validatePublish(row: any): Promise<void> {
    if (!row.title || !row.shortDescription) throw ApiError.validation([{ field: 'title', message: 'Title and short description are required' }]);
  }

  protected async dto(row: any) {
    const [features, seo] = await Promise.all([
      this.prisma.client.serviceFeature.findMany({ where: { serviceId: row.id }, orderBy: { sortOrder: 'asc' } }),
      this.seo.forEntity(EntityType.SERVICE, row.id),
    ]);
    const media = await this.media.resolveMany([row.imageMediaId]);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.shortDescription,
      bodyHtml: row.bodyHtml,
      imageMediaId: row.imageMediaId,
      image: mediaOf(media, row.imageMediaId),
      iconName: row.iconName,
      ctaLabel: row.ctaLabel,
      ctaHref: row.ctaHref,
      sortOrder: row.sortOrder,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      version: row.version,
      features: features.map((f) => ({ title: f.title, description: f.description })),
      seo: seo ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      warnings: row.status === 'PUBLISHED' && !row.imageMediaId ? [{ code: 'MISSING_IMAGE', message: 'Service has no image' }] : [],
    };
  }

  private card(row: any, features: any[], media: Map<string, any>) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.shortDescription,
      image: mediaOf(media, row.imageMediaId),
      iconName: row.iconName,
      features: features.map((f) => ({ title: f.title, description: f.description })),
      href: `/services/${row.slug}`,
    };
  }

  async listPublic() {
    const rows = await this.prisma.client.service.findMany({ where: LIVE(), orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] });
    return this.cardsFor(rows);
  }

  private async cardsFor(rows: any[]) {
    const ids = rows.map((r) => r.id);
    const features = ids.length ? await this.prisma.client.serviceFeature.findMany({ where: { serviceId: { in: ids } }, orderBy: { sortOrder: 'asc' } }) : [];
    const media = await this.media.resolveMany(rows.map((r) => r.imageMediaId));
    return { data: rows.map((r) => this.card(r, features.filter((f) => f.serviceId === r.id), media)) };
  }

  async servicesByIds(ids: string[]) {
    const rows = await this.prisma.client.service.findMany({ where: { ...LIVE(), id: { in: ids } } });
    const { data } = await this.cardsFor(rows);
    return ids.map((id) => data.find((d) => d.id === id)).filter(Boolean) as typeof data;
  }

  async detailPublic(slug: string) {
    const row = await this.prisma.client.service.findFirst({ where: { slug: slug.toLowerCase(), ...LIVE() } });
    if (!row) throw ApiError.notFound('Service');
    const features = await this.prisma.client.serviceFeature.findMany({ where: { serviceId: row.id }, orderBy: { sortOrder: 'asc' } });
    const media = await this.media.resolveMany([row.imageMediaId]);
    const seoRow = await this.seo.forEntity(EntityType.SERVICE, row.id);
    const seo = await buildSeo(this.prisma, {
      seo: seoRow as any,
      fallbackTitle: row.title,
      fallbackDescription: trimText(row.shortDescription, 160),
      path: `/services/${row.slug}`,
      type: 'article',
      image: mediaOf(media, row.imageMediaId),
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'Service', name: row.title, description: row.shortDescription }],
    });
    return { ...this.card(row, features, media), bodyHtml: row.bodyHtml, ctaLabel: row.ctaLabel, ctaHref: row.ctaHref, seo };
  }

}

@ApiTags('admin-services')
@Controller('admin/services')
export class ServicesAdminController extends CrudAdminController {
  protected readonly createSchema = serviceInput;
  protected readonly updateSchema = serviceUpdate;
  constructor(readonly crud: ServicesService) {
    super();
  }

  @Put(':id/features')
  features(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const { features } = parse(z.object({ features: z.array(feature).max(50) }).strict(), body);
    return this.crud.update(id, { features }, crudContext(req, user));
  }
}

@ApiTags('public-services')
@Controller('public/services')
export class ServicesPublicController {
  constructor(private readonly services: ServicesService) {}

  @Public()
  @Get()
  list() {
    return this.services.listPublic();
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.services.detailPublic(slug);
  }
}

