import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { mediaOf } from '../catalogue/shared';

/** Post card projection (PostCardDto). */
export async function postCards(prisma: PrismaService, media: MediaService, rows: any[]) {
  const map = await media.resolveMany(rows.map((r) => r.coverMediaId));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    cover: mediaOf(map, r.coverMediaId),
    category: r.category ? { slug: r.category.slug, name: r.category.name } : null,
    authorName: r.authorName ?? null,
    publishedAt: (r.publishedAt ?? r.createdAt).toISOString(),
    readingMinutes: r.readingMinutes,
    href: `/news/${r.slug}`,
  }));
}

/** Words at 200 per minute, at least one minute. */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
