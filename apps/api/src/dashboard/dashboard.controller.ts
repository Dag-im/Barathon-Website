import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationLog } from '@prisma/client';
import { ContactService } from '../contact/contact.service';
import { PrismaClient } from '@prisma/client';

type Counts = { total: number; published: number; draft: number; scheduled: number };

@ApiTags('admin-dashboard')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contact: ContactService,
  ) {}

  private async counts(model: 'product' | 'brand' | 'service' | 'post' | 'page'): Promise<Counts> {
    const db = (this.prisma.client as any)[model];
    const [total, published, draft, scheduled] = await Promise.all([
      db.count({}),
      db.count({ where: { status: 'PUBLISHED' } }),
      db.count({ where: { status: 'DRAFT' } }),
      db.count({ where: { status: 'SCHEDULED' } }),
    ]);
    return { total, published, draft, scheduled };
  }

  @Get()
  async dashboard() {
    const db = this.prisma.client;
    const [products, brands, services, posts, pages, videos, media, mediaBytes] = await Promise.all([
      this.counts('product'),
      this.counts('brand'),
      this.counts('service'),
      this.counts('post'),
      this.counts('page'),
      db.video.count({}),
      db.media.count({}),
      db.media.aggregate({ _sum: { sizeBytes: true } }),
    ]);
    const newMessages = await db.contactMessage.count({ where: { status: 'NEW' } });
    const totalMessages = await db.contactMessage.count({ where: { status: { in: ['NEW', 'READ', 'REPLIED', 'ARCHIVED'] } } });
    const since = new Date(Date.now() - 6 * 86_400_000);
    since.setUTCHours(0, 0, 0, 0);
    const recentForChart = await db.contactMessage.findMany({ where: { createdAt: { gte: since }, status: { not: 'SPAM' } }, select: { createdAt: true } });
    const last7d = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      return recentForChart.filter((m) => m.createdAt.toISOString().slice(0, 10) === day).length;
    });
    const recentMessages = await db.contactMessage.findMany({ where: { status: { not: 'SPAM' } }, orderBy: { createdAt: 'desc' }, take: 5 });
    const recentActivity = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    const upcoming = await db.$queryRaw<Array<{ entityType: string; id: string; title: string; scheduledAt: Date }>>`
      SELECT 'product' AS "entityType", id::text AS id, title, "scheduledAt" FROM products WHERE status = 'SCHEDULED' AND "scheduledAt" IS NOT NULL
      UNION ALL SELECT 'post', id::text, title, "scheduledAt" FROM posts WHERE status = 'SCHEDULED' AND "scheduledAt" IS NOT NULL
      ORDER BY "scheduledAt" ASC LIMIT 10`;
    const missingImages = await db.product.findMany({ where: { status: 'PUBLISHED', deletedAt: null, heroImageMediaId: null }, select: { id: true, title: true }, take: 50 });
    const unusedCutoff = new Date(Date.now() - 7 * 86_400_000);
    const usedIds = (await db.mediaRef.findMany({ distinct: ['mediaId'], select: { mediaId: true } })).map((r) => r.mediaId);
    const unusedMedia = await db.media.count({ where: { createdAt: { lt: unusedCutoff }, id: { notIn: usedIds } } });
    const lastReval = (await db.revalidationLog.findFirst({ orderBy: { createdAt: 'desc' } })) as RevalidationLog | null;
    const draftOlder = await db.product.count({ where: { status: 'DRAFT', updatedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
    const socialMissing = (await db.socialLink.count({ where: { visible: false } })) > 0;
    void PrismaClient;
    return {
      counts: {
        products,
        brands,
        services,
        posts,
        pages,
        videos: { total: videos },
        media: { total: media, sizeBytes: Number(mediaBytes._sum.sizeBytes ?? 0) },
      },
      messages: { new: newMessages, total: totalMessages, last7d },
      recentMessages: recentMessages.map((m) => this.contact.listItem(m)),
      recentActivity: recentActivity.map((a) => ({ id: a.id.toString(), action: a.action, entityType: a.entityType, entityId: a.entityId, summary: a.summary, actorEmail: a.actorEmail, createdAt: a.createdAt.toISOString() })),
      upcomingScheduled: upcoming.map((u) => ({ entityType: u.entityType, id: u.id, title: u.title, scheduledAt: u.scheduledAt.toISOString() })),
      health: {
        db: (await this.prisma.ping()) ? 'ok' : 'down',
        lastRevalidation: lastReval ? { status: lastReval.status, at: lastReval.createdAt.toISOString() } : null,
      },
      warnings: {
        missingImages: missingImages.map((p) => ({ entityType: 'product', id: p.id, title: p.title })),
        missingSeoDescription: 0,
        unusedMedia,
        draftOlderThan30d: draftOlder,
        socialLinksMissing: socialMissing,
      },
    };
  }
}
