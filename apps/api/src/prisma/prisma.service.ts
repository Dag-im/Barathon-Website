import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Models that carry a deletedAt column (soft delete). */
export const SOFT_DELETE_MODELS = new Set([
  'Media',
  'Page',
  'HeroSlide',
  'TimelineEntry',
  'CoreValue',
  'LeaderMessage',
  'TeamMember',
  'Brand',
  'ProductCategory',
  'Product',
  'Service',
  'Video',
  'Subsidiary',
  'Testimonial',
  'FaqGroup',
  'Faq',
  'PostCategory',
  'Post',
]);

/**
 * Adds `deletedAt: null` to read queries on soft-deletable models unless the caller
 * already filters on deletedAt (trash views pass `deletedAt: { not: null }`).
 */
export function withLiveFilter(model: string, args: any): any {
  if (!SOFT_DELETE_MODELS.has(model)) return args;
  const next = { ...(args ?? {}) };
  // Passing `deletedAt: undefined` explicitly disables the filter (used for slug checks and trash views).
  if (!next.where || !('deletedAt' in next.where)) {
    next.where = { ...(next.where ?? {}), deletedAt: null };
  }
  return next;
}

export function buildDbClient(url?: string) {
  const base = new PrismaClient({ datasources: url ? { db: { url } } : undefined });
  return base.$extends({
    query: {
      $allModels: {
        async findFirst({ model, args, query }: any) {
          return query(withLiveFilter(model, args));
        },
        async findMany({ model, args, query }: any) {
          return query(withLiveFilter(model, args));
        },
        async count({ model, args, query }: any) {
          return query(withLiveFilter(model, args));
        },
      },
    },
  });
}

export type DbClient = ReturnType<typeof buildDbClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');
  readonly client: DbClient = buildDbClient();

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
