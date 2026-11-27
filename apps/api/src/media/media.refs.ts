import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MediaRefInput {
  field: string;
  mediaId: string | null | undefined;
}

const MEDIA_PATH = /\/media\/\d{4}\/\d{2}\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//gi;

/** Extracts media ids referenced from sanitized HTML (images and video sources under /media/). */
export function mediaIdsInHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const m of html.matchAll(MEDIA_PATH)) ids.add(m[1].toLowerCase());
  return [...ids];
}

/**
 * Maintains the reverse index used for usage tracking and the MEDIA_IN_USE rule
 * (backend-plan 3.6). Each save replaces the entity's rows.
 */
@Injectable()
export class MediaRefService {
  constructor(private readonly prisma: PrismaService) {}

  async replace(entityType: string, entityId: string, refs: MediaRefInput[], htmlFields: Array<{ field: string; html: string | null | undefined }> = []): Promise<void> {
    const rows = new Map<string, { mediaId: string; field: string }>();
    for (const r of refs) {
      if (r.mediaId) rows.set(`${r.mediaId}|${r.field}`, { mediaId: r.mediaId, field: r.field });
    }
    for (const h of htmlFields) {
      for (const id of mediaIdsInHtml(h.html)) rows.set(`${id}|${h.field}`, { mediaId: id, field: h.field });
    }
    const db = this.prisma.client;
    await db.$transaction([
      db.mediaRef.deleteMany({ where: { entityType, entityId } }),
      ...(rows.size
        ? [
            db.mediaRef.createMany({
              data: [...rows.values()].map((r) => ({ mediaId: r.mediaId, entityType, entityId, field: r.field })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }

  async remove(entityType: string, entityId: string): Promise<void> {
    await this.prisma.client.mediaRef.deleteMany({ where: { entityType, entityId } });
  }

  async usageOf(mediaId: string) {
    return this.prisma.client.mediaRef.findMany({ where: { mediaId } });
  }
}
