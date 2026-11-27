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

const list = z.object({ title: z.string().min(1).max(120), style: z.enum(['BULLETS', 'CHECKS', 'CHIPS']), items: z.array(z.string().min(1).max(300)).max(50) }).strict();
export const subsidiaryInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().max(96).optional(),
    legalName: z.string().max(200).nullable().optional(),
    kind: z.enum(['LLC', 'PLC', 'OTHER']).default('OTHER'),
    countryCode: z.string().length(2),
    regionNote: z.string().max(120).nullable().optional(),
    tagline: z.string().max(300).nullable().optional(),
    introHtml: z.string().max(50_000),
    bodyHtml: z.string().max(100_000).nullable().optional(),
    lists: z.array(list).max(10).optional(),
    brandLinks: z.array(z.object({ brandId: z.string().uuid(), relation: z.enum(['OFFICIAL_AGENT', 'EXCLUSIVE_RIGHTS']).default('EXCLUSIVE_RIGHTS') }).strict()).max(20).optional(),
    logoMediaId: z.string().uuid().nullable().optional(),
    imageMediaId: z.string().uuid().nullable().optional(),
    websiteUrl: z.string().url().max(500).nullable().optional(),
    sortOrder: z.number().int().optional(),
    seo: z.any().optional(),
  })
  .strict();
export const subsidiaryUpdate = subsidiaryInput.partial().extend({ expectedVersion: z.number().int().optional() }).strict();

@Injectable()
export class SubsidiariesService extends PublishableCrud<any> {
  protected readonly delegate = 'subsidiary';
  protected readonly entityName = 'subsidiary';
  protected readonly seoType: EntityType = EntityType.SUBSIDIARY;
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

  protected tags(row: any): TagSet {
    return { tags: ['subsidiaries', 'pages', 'sitemap'], paths: ['/about'] };
  }

  protected async mediaIndex(row: any) {
    return { refs: [{ field: 'logoMediaId', mediaId: row.logoMediaId }, { field: 'imageMediaId', mediaId: row.imageMediaId }], html: [{ field: 'introHtml', html: row.introHtml }, { field: 'bodyHtml', html: row.bodyHtml }] };
  }

  protected async prepare(input: Record<string, unknown>) {
    const i = input as any;
    await assertMedia(this.prisma, [i.logoMediaId, i.imageMediaId], ['IMAGE', 'SVG', 'ICON'], 'logoMediaId');
    const data: Record<string, unknown> = {};
    for (const k of ['slug', 'kind', 'legalName', 'regionNote', 'tagline', 'logoMediaId', 'imageMediaId', 'websiteUrl', 'sortOrder']) if (i[k] !== undefined) data[k] = i[k];
    if (i.name !== undefined) data.name = plainText(i.name);
    if (i.countryCode !== undefined) data.countryCode = String(i.countryCode).toUpperCase();
    if (i.introHtml !== undefined) data.introHtml = sanitizeRichText(i.introHtml);
    if (i.bodyHtml !== undefined) data.bodyHtml = i.bodyHtml ? sanitizeRichText(i.bodyHtml) : null;
    if (i.lists !== undefined) data.lists = i.lists;
    return data;
  }

  protected async afterWrite(row: any, input: Record<string, unknown> | null): Promise<void> {
    const links = (input as any)?.brandLinks;
    if (links === undefined) return;
    for (const l of links) await assertLive(this.prisma, 'brand', l.brandId, 'brandLinks');
    const db = this.prisma.client;
    await db.$transaction([
      db.subsidiaryBrand.deleteMany({ where: { subsidiaryId: row.id } }),
      db.subsidiaryBrand.createMany({ data: links.map((l: any, n: number) => ({ subsidiaryId: row.id, brandId: l.brandId, relation: l.relation, sortOrder: n })) }),
    ]);
  }

  protected async dto(row: any) {
    const [links, seo] = await Promise.all([
      this.prisma.client.subsidiaryBrand.findMany({ where: { subsidiaryId: row.id }, orderBy: { sortOrder: 'asc' } }),
      this.seo.forEntity(EntityType.SUBSIDIARY, row.id),
    ]);
    const media = await this.media.resolveMany([row.logoMediaId, row.imageMediaId]);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      legalName: row.legalName,
      kind: row.kind,
      countryCode: row.countryCode,
      regionNote: row.regionNote,
      tagline: row.tagline,
      introHtml: row.introHtml,
      bodyHtml: row.bodyHtml,
      lists: row.lists,
      brandLinks: links.map((l) => ({ brandId: l.brandId, relation: l.relation })),
      logo: mediaOf(media, row.logoMediaId),
      image: mediaOf(media, row.imageMediaId),
      websiteUrl: row.websiteUrl,
      sortOrder: row.sortOrder,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      version: row.version,
      seo: seo ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  async listPublic() {
    return { data: await this.publicList() };
  }

  /** SUBSIDIARIES block and public list: partner brands are included as cards. */
  async publicList(ids?: string[]) {
    const where: Record<string, unknown> = { ...LIVE(), ...(ids?.length ? { id: { in: ids } } : {}) };
    const rows = await this.prisma.client.subsidiary.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const out: any[] = [];
    for (const r of rows) out.push(await this.toPublic(r));
    return ids?.length ? ids.map((id) => out.find((o) => o.id === id)).filter(Boolean) : out;
  }

  async detailPublic(slug: string) {
    const row = await this.prisma.client.subsidiary.findFirst({ where: { slug: slug.toLowerCase(), ...LIVE() } });
    if (!row) throw ApiError.notFound('Subsidiary');
    return this.toPublic(row);
  }

  private async toPublic(row: any) {
    const links = await this.prisma.client.subsidiaryBrand.findMany({ where: { subsidiaryId: row.id }, orderBy: { sortOrder: 'asc' }, include: { brand: true } });
    const brandIds = links.map((l) => l.brandId);
    const media = await this.media.resolveMany([row.logoMediaId, row.imageMediaId]);
    const brandCards = await this.brandCards(brandIds);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      legalName: row.legalName,
      countryCode: row.countryCode,
      regionNote: row.regionNote,
      tagline: row.tagline,
      introHtml: row.introHtml,
      bodyHtml: row.bodyHtml,
      lists: (row.lists ?? []).map((l: any) => ({ title: l.title, style: l.style, items: l.items })),
      partnerBrands: links.map((l) => ({ brand: brandCards.get(l.brandId), relation: l.relation })).filter((p) => p.brand),
      logo: mediaOf(media, row.logoMediaId),
      image: mediaOf(media, row.imageMediaId),
      websiteUrl: row.websiteUrl,
      anchorId: row.slug,
    };
  }

  private async brandCards(ids: string[]) {
    const map = new Map<string, any>();
    if (!ids.length) return map;
    const rows = await this.prisma.client.brand.findMany({ where: { ...LIVE(), id: { in: ids } } });
    const media = await this.media.resolveMany(rows.flatMap((r) => [r.logoMediaId, r.logoDarkMediaId]));
    for (const r of rows) map.set(r.id, { id: r.id, slug: r.slug, name: r.name, kind: r.kind, shortDescription: r.shortDescription, logo: mediaOf(media, r.logoMediaId), logoDark: mediaOf(media, r.logoDarkMediaId), country: { code: r.countryCode, name: r.countryName, city: r.city }, href: `/brands/${r.slug}` });
    return map;
  }
}

@ApiTags('admin-subsidiaries')
@Controller('admin/subsidiaries')
export class SubsidiariesAdminController extends CrudAdminController {
  protected readonly createSchema = subsidiaryInput;
  protected readonly updateSchema = subsidiaryUpdate;
  constructor(readonly crud: SubsidiariesService) {
    super();
  }
}

@ApiTags('public-subsidiaries')
@Controller('public/subsidiaries')
export class SubsidiariesPublicController {
  constructor(private readonly subs: SubsidiariesService) {}

  @Public()
  @Get()
  list() {
    return this.subs.listPublic();
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.subs.detailPublic(slug);
  }
}

