import { Injectable } from '@nestjs/common';
import { Prisma, SiteSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/utils/errors';
import { mediaOf } from '../catalogue/shared';
import { MediaService } from '../media/media.service';
import { SETTINGS_DEFAULTS, UI_STRING_DEFAULTS } from './defaults';
import { GroupName, groupSchemas, groupToColumns } from './settings.dto';
import { MediaRefService } from '../media/media.refs';
import { RevalidationService } from '../revalidation/revalidation.service';
import { AuditService } from '../audit/audit.service';
import { tagsFor } from '../common/constants/revalidation-map';
import { CrudContext } from '../common/content/content-crud';
import { diffOf } from '../common/content/content-crud';

const MEDIA_COLUMNS = ['logoLightMediaId', 'logoDarkMediaId', 'faviconMediaId', 'appleTouchIconMediaId', 'defaultOgImageMediaId'] as const;

/** Singleton site settings (backend-plan 3.7). */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly refs: MediaRefService,
    private readonly revalidation: RevalidationService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  /** Returns the singleton row, creating it from code defaults on first access. */
  async row(): Promise<SiteSettings> {
    const existing = await this.db.siteSettings.findUnique({ where: { id: 'singleton' } });
    if (existing) return existing;
    const d = SETTINGS_DEFAULTS;
    return this.db.siteSettings.create({
      data: {
        id: 'singleton',
        siteName: d.siteName,
        legalName: d.legalName,
        tagline: d.tagline,
        brandColors: d.brandColors,
        headerCta: d.headerCta,
        search: d.search,
        footerBlurb: d.footerBlurb,
        copyrightText: d.copyrightText,
        footerCredit: d.footerCredit,
        seoDefaults: d.seoDefaults,
        analytics: d.analytics,
        maintenance: d.maintenance,
        announcement: d.announcement,
        contactForm: d.contactForm,
        robots: d.robots,
        sitemap: d.sitemap,
      },
    });
  }

  async adminDto() {
    const row = await this.row();
    const media = await this.media.resolveMany(MEDIA_COLUMNS.map((c) => (row as any)[c]));
    const out: Record<string, unknown> = {
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
      branding: { siteName: row.siteName, legalName: row.legalName, tagline: row.tagline, brandColors: row.brandColors, logoLightMediaId: row.logoLightMediaId, logoDarkMediaId: row.logoDarkMediaId, faviconMediaId: row.faviconMediaId, appleTouchIconMediaId: row.appleTouchIconMediaId, defaultOgImageMediaId: row.defaultOgImageMediaId, logoLight: mediaOf(media, row.logoLightMediaId), logoDark: mediaOf(media, row.logoDarkMediaId), favicon: mediaOf(media, row.faviconMediaId), appleTouchIcon: mediaOf(media, row.appleTouchIconMediaId), defaultOgImage: mediaOf(media, row.defaultOgImageMediaId) },
      header: { headerCta: row.headerCta, search: row.search },
      footer: { footerBlurb: row.footerBlurb, copyrightText: row.copyrightText, footerCredit: row.footerCredit },
      seo: { seoDefaults: row.seoDefaults },
      analytics: row.analytics,
      maintenance: row.maintenance,
      announcement: row.announcement,
      'contact-form': row.contactForm,
      robots: row.robots,
      sitemap: row.sitemap,
    };
    return out;
  }

  private mediaIdsOf(data: Record<string, unknown>): string[] {
    return MEDIA_COLUMNS.map((c) => data[c] as string | null | undefined).filter((x): x is string => !!x);
  }

  /** Validates every provided group, checks media ids, applies the write and logs a revision. */
  async update(payload: Record<string, unknown>, expectedVersion: number | undefined, ctx: CrudContext, group?: GroupName) {
    const current = await this.row();
    if (expectedVersion !== undefined && expectedVersion !== current.version) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Settings were changed by someone else', [{ field: 'version', message: String(current.version), code: 'current' }]);
    }
    const groups: GroupName[] = group ? [group] : (Object.keys(payload) as GroupName[]).filter((k) => k in groupSchemas);
    const data: Record<string, unknown> = {};
    for (const g of groups) {
      const schema = groupSchemas[g] as unknown as { parse: (v: unknown) => Record<string, unknown> };
      const body = schema.parse(payload[g] ?? {}) as Record<string, unknown>;
      Object.assign(data, groupToColumns(g, body));
    }
    const mediaIds = this.mediaIdsOf(data);
    if (mediaIds.length) {
      const rows = await this.db.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true } });
      if (rows.length !== new Set(mediaIds).size) throw ApiError.validation([{ field: 'media', message: 'Some media items do not exist' }]);
    }
    const beforeDto = await this.adminDto();
    const updated = await this.db.siteSettings.update({
      where: { id: 'singleton' },
      data: { ...(data as Prisma.SiteSettingsUpdateInput), version: { increment: 1 }, updatedById: ctx.userId },
    });
    await this.refs.replace('site', 'singleton', MEDIA_COLUMNS.map((c) => ({ field: c, mediaId: (updated as any)[c] })));
    const afterDto = await this.adminDto();
    const diff = diffOf(beforeDto as Record<string, unknown>, afterDto as Record<string, unknown>);
    await this.db.contentRevision.create({
      data: {
        entityType: 'site_settings',
        entityId: 'singleton',
        versionNo: updated.version,
        snapshot: JSON.parse(JSON.stringify(afterDto)),
        changeNote: group ? `Updated ${group}` : 'Updated settings',
        authorId: ctx.userId,
        authorName: ctx.email,
      },
    });
    await this.audit.record({ action: 'SETTINGS_UPDATE', summary: `Updated site settings${group ? ` (${group})` : ''}`, entityType: 'SiteSettings', entityId: 'singleton', diff, actorId: ctx.userId, actorEmail: ctx.email, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId });
    const t = tagsFor('site');
    this.revalidation.enqueue(t.tags, t.paths);
    return afterDto;
  }

  async revisions() {
    const rows = await this.db.contentRevision.findMany({ where: { entityType: 'site_settings', entityId: 'singleton' }, orderBy: { versionNo: 'desc' }, take: 50 });
    return { data: rows.map((r: any) => ({ id: r.id, versionNo: r.versionNo, changeNote: r.changeNote, author: r.authorName ? { id: r.authorId, name: r.authorName } : null, createdAt: r.createdAt.toISOString() })) };
  }

  /** Resolved bootstrap values used by the public site endpoint. */
  async publicCore() {
    const row = await this.row();
    const media = await this.media.resolveMany(MEDIA_COLUMNS.map((c) => (row as any)[c]));
    const year = new Date().getUTCFullYear();
    const credit = row.footerCredit as { enabled: boolean; prefix: string; name: string; url: string | null };
    const ann = row.announcement as { enabled: boolean; text: string; linkLabel: string | null; href: string | null; variant: string; startsAt: string | null; endsAt: string | null };
    const now = Date.now();
    const announcementActive = ann.enabled && (!ann.startsAt || Date.parse(ann.startsAt) <= now) && (!ann.endsAt || Date.parse(ann.endsAt) > now);
    return {
      siteName: row.siteName,
      legalName: row.legalName,
      tagline: row.tagline,
      locale: 'en' as const,
      logoLight: mediaOf(media, row.logoLightMediaId),
      logoDark: mediaOf(media, row.logoDarkMediaId),
      favicon: mediaOf(media, row.faviconMediaId),
      appleTouchIcon: mediaOf(media, row.appleTouchIconMediaId),
      defaultOgImage: mediaOf(media, row.defaultOgImageMediaId),
      brandColors: row.brandColors,
      headerCta: row.headerCta,
      search: row.search,
      footer: { blurb: row.footerBlurb, copyright: row.copyrightText.replace('{year}', String(year)), credit: { enabled: credit.enabled, prefix: credit.prefix, name: credit.name, url: credit.url } },
      announcement: announcementActive ? { text: ann.text, linkLabel: ann.linkLabel, href: ann.href, variant: ann.variant } : null,
      maintenance: row.maintenance,
      analytics: row.analytics,
      seoDefaults: row.seoDefaults,
      contactForm: { consentRequired: (row.contactForm as any).consentRequired, consentText: (row.contactForm as any).consentText, captchaProvider: (row.contactForm as any).captchaProvider },
    };
  }

}

/** UI strings: defaults in code, DB rows override per key and locale. */
@Injectable()
export class UiStringService {
  constructor(private readonly prisma: PrismaService) {}

  defaults(): Map<string, { value: string; group: string }> {
    return new Map(UI_STRING_DEFAULTS.map((d) => [d.key, { value: d.value, group: d.group }]));
  }

  async merged(group?: string, locale = 'en'): Promise<Record<string, string>> {
    const overrides = await this.prisma.client.uiString.findMany({ where: { locale } });
    const out: Record<string, string> = {};
    for (const d of UI_STRING_DEFAULTS) if (!group || d.group === group) out[d.key] = d.value;
    for (const o of overrides) if (!group || o.group === group) out[o.key] = o.value;
    return out;
  }
}
