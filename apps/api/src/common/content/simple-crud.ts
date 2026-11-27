import { ApiError } from '../utils/errors';
import { parse } from './crud.controller';
import { z, ZodTypeAny } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * CRUD for non-publishable child-like resources (contact channels, offices, social links,
 * FAQ items, post categories, tags). Writes are audited by the caller when needed.
 */
export class SimpleCrud {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delegate: string,
    private readonly createSchema: ZodTypeAny,
    private readonly updateSchema: ZodTypeAny,
    private readonly orderBy: unknown = [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  ) {}

  private get db(): any {
    return (this.prisma.client as any)[this.delegate];
  }

  list(where: Record<string, unknown> = {}) {
    return this.db.findMany({ where, orderBy: this.orderBy });
  }

  async get(id: string) {
    const row = await this.db.findFirst({ where: { id } });
    if (!row) throw ApiError.notFound(this.delegate);
    return row;
  }

  create(body: unknown, extra: Record<string, unknown> = {}) {
    return this.db.create({ data: { ...parse(this.createSchema, body), ...extra } });
  }

  async update(id: string, body: unknown, extra: Record<string, unknown> = {}) {
    await this.get(id);
    return this.db.update({ where: { id }, data: { ...parse(this.updateSchema, body), ...extra } });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.db.delete({ where: { id } });
  }

  /** Writes sortOrder 0..n-1 for the given ids (must be the full set). */
  async reorder(ids: string[]): Promise<void> {
    const rows = (await this.db.findMany({ select: { id: true } })) as Array<{ id: string }>;
    if (rows.length !== ids.length || new Set(ids).size !== ids.length || rows.some((r) => !ids.includes(r.id))) {
      throw ApiError.validation([{ field: 'ids', message: 'ids must list every item exactly once' }]);
    }
    await this.prisma.client.$transaction(ids.map((id, i) => this.db.update({ where: { id }, data: { sortOrder: i } })));
  }
}

export const reorderBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).strict();
