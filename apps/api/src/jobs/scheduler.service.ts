import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppConfig, APP_CONFIG } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from '../revalidation/revalidation.service';

const MODELS = ['product', 'brand', 'service', 'post', 'page', 'video', 'productCategory', 'subsidiary'] as const;

/**
 * In-process scheduler (replaces pg-boss for v1; see README). Publishes scheduled rows every
 * minute with a guarded UPDATE so overlapping ticks publish each row once, and purges trash
 * older than TRASH_RETENTION_DAYS once a day.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Scheduler');
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly reval: RevalidationService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    if (this.config.env.NODE_ENV === 'test') return;
    this.timers.push(setInterval(() => void this.publishDue(), 60_000));
    this.timers.push(setInterval(() => void this.purgeTrash(), 86_400_000));
    this.timers.forEach((t) => t.unref());
  }

  onModuleDestroy(): void {
    this.timers.forEach((t) => clearInterval(t));
  }

  /** Publishes rows whose scheduledAt has passed. Returns the number of rows published. */
  async publishDue(now = new Date()): Promise<number> {
    let total = 0;
    const db = this.prisma.client as any;
    for (const model of MODELS) {
      try {
        const due = await db[model].findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now }, deletedAt: null }, select: { id: true, scheduledAt: true } });
        for (const row of due) {
          // Guarded update: only the first writer wins when ticks overlap.
          const res = await db[model].updateMany({
            where: { id: row.id, status: 'SCHEDULED' },
            data: { status: 'PUBLISHED', publishedAt: row.scheduledAt, scheduledAt: null, version: { increment: 1 } },
          });
          if (res.count) {
            total += 1;
            await this.prisma.client.auditLog.create({ data: { action: 'PUBLISH', entityType: model, entityId: row.id, summary: `Published ${model} on schedule`, actorEmail: 'SYSTEM' } });
          }
        }
        if (due.length) this.reval.enqueue(['sitemap', 'pages', 'products', 'brands', 'services', 'posts', 'videos'], []);
      } catch (err) {
        this.logger.error({ model, err: (err as Error).message }, 'scheduled publish failed');
      }
    }
    return total;
  }

  /** Hard-deletes items that have been in the trash longer than the retention window. */
  async purgeTrash(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.config.env.TRASH_RETENTION_DAYS * 86_400_000);
    const db = this.prisma.client as any;
    let total = 0;
    for (const model of MODELS) {
      const r = await db[model].deleteMany({ where: { deletedAt: { lt: cutoff } } }).catch(() => ({ count: 0 }));
      total += r.count;
    }
    const audit = await this.prisma.client.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - this.config.env.AUDIT_RETENTION_DAYS * 86_400_000) } } });
    this.logger.log(`purged ${total} trashed rows and ${audit.count} audit rows`);
    return total;
  }
}
