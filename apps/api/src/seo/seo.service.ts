import { Injectable } from '@nestjs/common';
import { EntityType, Prisma, TwitterCard } from '@prisma/client';
import { ApiError } from '../common/utils/errors';
import { PrismaService } from '../prisma/prisma.service';

export interface SeoInput {
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageId?: string | null;
  twitterCard?: 'SUMMARY' | 'SUMMARY_LARGE_IMAGE';
  canonicalUrl?: string | null;
  noindex?: boolean;
  nofollow?: boolean;
  keywords?: string | null;
  jsonLd?: unknown;
}

/** Accepts absolute https URLs or site-relative paths for canonical overrides. */
function validCanonical(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  return /^https:\/\//.test(url);
}

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upserts the SEO row of an entity; a null/undefined input leaves it unchanged. */
  async upsert(entityType: EntityType, entityId: string, input: SeoInput | null | undefined): Promise<void> {
    if (!input) return;
    if (!validCanonical(input.canonicalUrl)) {
      throw ApiError.validation([{ field: 'seo.canonicalUrl', message: 'Canonical must be https or a site path' }]);
    }
    if (input.jsonLd) {
      const size = Buffer.byteLength(JSON.stringify(input.jsonLd));
      if (size > 16 * 1024) throw ApiError.validation([{ field: 'seo.jsonLd', message: 'JSON-LD override is larger than 16 KB' }]);
      const list = Array.isArray(input.jsonLd) ? input.jsonLd : [input.jsonLd];
      for (const item of list) {
        if (!item || typeof item !== 'object' || !String((item as Record<string, unknown>)['@context'] ?? '').includes('schema.org')) {
          throw ApiError.validation([{ field: 'seo.jsonLd', message: 'Each JSON-LD object needs "@context" containing schema.org' }]);
        }
      }
    }
    const data = {
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      ogTitle: input.ogTitle ?? null,
      ogDescription: input.ogDescription ?? null,
      ogImageId: input.ogImageId ?? null,
      twitterCard: (input.twitterCard as TwitterCard) ?? TwitterCard.SUMMARY_LARGE_IMAGE,
      canonicalUrl: input.canonicalUrl ?? null,
      noindex: input.noindex ?? false,
      nofollow: input.nofollow ?? false,
      keywords: input.keywords ?? null,
      jsonLd: input.jsonLd === undefined || input.jsonLd === null ? Prisma.JsonNull : (input.jsonLd as Prisma.InputJsonValue),
    };
    await this.prisma.client.seoMeta.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: { entityType, entityId, ...data },
      update: data,
    });
  }

  async forEntity(entityType: EntityType, entityId: string) {
    return this.prisma.client.seoMeta.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
  }

  async forEntities(entityType: EntityType, ids: string[]): Promise<Map<string, Awaited<ReturnType<SeoService['forEntity']>>>> {
    const rows = ids.length ? await this.prisma.client.seoMeta.findMany({ where: { entityType, entityId: { in: ids } } }) : [];
    return new Map(rows.map((r) => [r.entityId, r]));
  }

  async deleteFor(entityType: EntityType, entityId: string): Promise<void> {
    await this.prisma.client.seoMeta.deleteMany({ where: { entityType, entityId } });
  }
}
