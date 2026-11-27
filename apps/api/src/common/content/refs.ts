import { ApiError } from '../utils/errors';
import { PrismaService } from '../../prisma/prisma.service';

export const LIVE = (now: Date = new Date()) => ({
  status: 'PUBLISHED' as const,
  OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
});

/** Throws 422 unless every id is an existing, live media row of an allowed kind. */
export async function assertMedia(prisma: PrismaService, ids: Array<string | null | undefined>, kinds?: string[], field = 'mediaId'): Promise<void> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return;
  const rows = await prisma.client.media.findMany({ where: { id: { in: unique } }, select: { id: true, kind: true } });
  const found = new Map(rows.map((r) => [r.id, r.kind as string]));
  for (const id of unique) {
    const kind = found.get(id);
    if (!kind) throw ApiError.validation([{ field, message: `Media ${id} does not exist`, code: 'missing' }]);
    if (kinds && !kinds.includes(kind)) throw ApiError.validation([{ field, message: `Media ${id} is a ${kind}, expected ${kinds.join(' or ')}`, code: 'kind' }]);
  }
}

/** Throws 422 unless the id refers to a live row of the given Prisma model. */
export async function assertLive(prisma: PrismaService, model: string, id: string | null | undefined, field: string): Promise<void> {
  if (!id) return;
  const row = await (prisma.client as any)[model].findFirst({ where: { id }, select: { id: true } });
  if (!row) throw ApiError.validation([{ field, message: `Referenced ${model} does not exist`, code: 'missing' }]);
}
