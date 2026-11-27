import { ApiError } from '../utils/errors';
import { paged, skipTake } from '../utils/pagination';
import { slugify, SLUG_PATTERN, RESERVED_SLUGS } from '../utils/slug';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RevalidationService } from '../../revalidation/revalidation.service';
import { SeoService, SeoInput } from '../../seo/seo.service';
import { MediaRefService } from '../../media/media.refs';
import { RequestContext } from '../../auth/auth.types';
import { TagSet } from '../constants/revalidation-map';
import { EntityType } from '@prisma/client';
import { RedirectsService } from '../../redirects/redirects.service';

export type Action = 'publish' | 'unpublish' | 'schedule' | 'archive';

export interface ListOptions {
  q?: string;
  status?: string[];
  deleted?: boolean;
  page: number;
  pageSize: number;
  sort?: string;
  extra?: Record<string, unknown>;
}

export interface CrudContext extends RequestContext {
  userId: string | null;
  email: string | null;
}

export interface BaseRow {
  id: string;
  version: number;
  status?: string;
  publishedAt?: Date | null;
  scheduledAt?: Date | null;
  sortOrder?: number;
  slug?: string;
  deletedAt?: Date | null;
  [k: string]: unknown;
}

/**
 * Shared admin workflow for publishable resources (backend-plan 6.3.0 and 6.4):
 * slug rules, optimistic versioning, status transitions, soft delete and trash, ordering,
 * revisions, audit, SEO upsert, media usage index and revalidation.
 */
export abstract class PublishableCrud<Row extends BaseRow = BaseRow> {
  /** Prisma model accessor name, e.g. "product". */
  protected abstract readonly delegate: string;
  /** Entity name used for audit, revisions and revalidation maps. */
  protected abstract readonly entityName: string;
  /** SEO entity type, when the resource has an SEO panel. */
  protected readonly seoType: EntityType | null = null;
  /** Whether the resource supports draft/publish/schedule transitions. */
  protected readonly publishable: boolean = true;
  /** Whether the resource has a slug column. */
  protected readonly hasSlug: boolean = true;
  /** Whether the resource supports drag-and-drop ordering. */
  protected readonly ordered: boolean = true;
  protected readonly searchFields: string[] = ['title'];

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly audit: AuditService,
    protected readonly revalidation: RevalidationService,
    protected readonly seo: SeoService,
    protected readonly refs: MediaRefService,
    protected readonly redirects: RedirectsService,
  ) {}

  protected get db(): any {
    return (this.prisma.client as any)[this.delegate];
  }

  protected include(): Record<string, unknown> | undefined {
    return undefined;
  }

  /** Converts validated input into Prisma data. Throws ApiError on invalid references. */
  protected abstract prepare(input: Record<string, unknown>, existing: Row | null): Promise<Record<string, unknown>>;

  /** Admin DTO representation (also the revision snapshot). */
  protected abstract dto(row: Row): Promise<Record<string, unknown>>;

  /** Revalidation tags/paths affected by this row. */
  protected abstract tags(row: Row): TagSet;

  /** Media fields and HTML fields to index for usage tracking. */
  protected async mediaIndex(_row: Row): Promise<{ refs: Array<{ field: string; mediaId: string | null | undefined }>; html: Array<{ field: string; html: string | null | undefined }> }> {
    return { refs: [], html: [] };
  }

  /** Hook run after a successful write (e.g. child rows). */
  protected async afterWrite(_row: Row, _input: Record<string, unknown> | null, _ctx: CrudContext): Promise<void> {}

  /** Extra validation applied before publish. */
  protected async validatePublish(_row: Row): Promise<void> {}

  /** Public path of a row for redirects and revalidation; empty means no public page. */
  protected publicPath(_slug: string): string {
    return '';
  }

  /** Slug changes on published rows create automatic redirects (backend-plan 3.3). */
  protected async onSlugChanged(oldSlug: string, newSlug: string, _row: Row): Promise<void> {
    const from = this.publicPath(oldSlug);
    const to = this.publicPath(newSlug);
    if (from && to) await this.redirects.addAuto(from, to);
  }

  // ------------------------------------------------------------------ reads

  protected where(opts: ListOptions): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (opts.deleted) where.deletedAt = { not: null };
    if (opts.status?.length) where.status = { in: opts.status };
    if (opts.q) {
      where.OR = this.searchFields.map((f) => ({ [f]: { contains: opts.q, mode: 'insensitive' } }));
    }
    return { ...where, ...(opts.extra ?? {}) };
  }

  protected orderBy(sort?: string): unknown {
    if (!sort) return this.ordered ? [{ sortOrder: 'asc' }, { createdAt: 'asc' }] : [{ createdAt: 'desc' }];
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    return [{ [field]: desc ? 'desc' : 'asc' }, { id: 'asc' }];
  }

  async list(opts: ListOptions) {
    const where = this.where(opts);
    const [rows, total] = await Promise.all([
      this.db.findMany({ where, orderBy: this.orderBy(opts.sort), include: this.include(), ...skipTake(opts.page, opts.pageSize) }),
      this.db.count({ where }),
    ]);
    const data = await Promise.all((rows as Row[]).map((r) => this.dto(r)));
    return paged(data, total, opts.page, opts.pageSize);
  }

  async findOrFail(id: string, trashed = false): Promise<Row> {
    const row = await this.db.findFirst({
      where: { id, ...(trashed ? { deletedAt: { not: null } } : {}) },
      include: this.include(),
    });
    if (!row) throw ApiError.notFound(this.entityName);
    return row as Row;
  }

  async getDto(id: string) {
    return this.dto(await this.findOrFail(id));
  }

  // ------------------------------------------------------------------ slugs

  protected async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base) || 'item';
    let candidate = root;
    for (let n = 2; ; n++) {
      const clash = await this.db.findFirst({
        where: { slug: candidate, deletedAt: undefined, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${root}-${n}`.slice(0, 96);
    }
  }

  protected async resolveSlug(input: Record<string, unknown>, existing: Row | null): Promise<string | undefined> {
    if (!this.hasSlug) return undefined;
    const provided = typeof input.slug === 'string' && input.slug.trim() ? input.slug.trim().toLowerCase() : null;
    if (provided) {
      if (!SLUG_PATTERN.test(provided)) throw ApiError.validation([{ field: 'slug', message: 'Slug may contain lowercase letters, digits and hyphens only' }]);
      if (RESERVED_SLUGS.has(provided)) throw new ApiError(409, 'SLUG_RESERVED', `The slug "${provided}" is reserved`);
      const clash = await this.db.findFirst({ where: { slug: provided, deletedAt: undefined, ...(existing ? { NOT: { id: existing.id } } : {}) }, select: { id: true } });
      if (clash) throw new ApiError(409, 'SLUG_TAKEN', `The slug "${provided}" is already in use`);
      return provided;
    }
    if (existing) return undefined;
    const title = String(input.title ?? input.name ?? input.quote ?? input.question ?? '');
    return this.uniqueSlug(title || 'item');
  }

  // ------------------------------------------------------------------ writes

  async create(input: Record<string, unknown>, ctx: CrudContext) {
    const { seo, expectedVersion: _ev, ...rest } = input as Record<string, unknown> & { seo?: SeoInput };
    const slug = await this.resolveSlug(rest, null);
    const data = await this.prepare({ ...rest, ...(slug ? { slug } : {}) }, null);
    if (this.publishable && !data.status) data.status = 'DRAFT';
    const row = (await this.db.create({ data: { ...data, version: 1, ...this.actorColumns(ctx, true) } })) as Row;
    if (this.seoType) await this.seo.upsert(this.seoType, row.id, seo);
    await this.afterWrite(row, input, ctx);
    const mi = await this.mediaIndex(row);
    await this.refs.replace(this.entityName, row.id, mi.refs, mi.html);
    await this.revision(row, ctx, 'Created');
    await this.audit.record({ action: 'CREATE', summary: `Created ${this.entityName} "${this.titleOf(row)}"`, entityType: this.entityName, entityId: row.id, ...this.actor(ctx) });
    this.emit(row);
    return this.dto(await this.findOrFail(row.id));
  }

  async update(id: string, input: Record<string, unknown>, ctx: CrudContext) {
    const existing = await this.findOrFail(id);
    const expected = input.expectedVersion as number | undefined;
    if (expected !== undefined && expected !== existing.version) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'The record was changed by someone else', [{ field: 'version', message: String(existing.version), code: 'current' }]);
    }
    const { seo, expectedVersion: _ev, ...rest } = input as Record<string, unknown> & { seo?: SeoInput };
    const slug = await this.resolveSlug(rest, existing);
    const before = await this.dto(existing);
    const data = await this.prepare({ ...rest, ...(slug ? { slug } : {}) }, existing);
    const updated = (await this.db.update({ where: { id }, data: { ...data, version: { increment: 1 }, ...this.actorColumns(ctx, false) } })) as Row;
    if (this.seoType && seo !== undefined) await this.seo.upsert(this.seoType, id, seo);
    if (slug && existing.slug && slug !== existing.slug && existing.status === 'PUBLISHED') {
      await this.onSlugChanged(existing.slug, slug, updated);
    }
    await this.afterWrite(updated, input, ctx);
    const mi = await this.mediaIndex(updated);
    await this.refs.replace(this.entityName, id, mi.refs, mi.html);
    const after = await this.dto(await this.findOrFail(id));
    const diff = diffOf(before, after);
    if (Object.keys(diff).length === 0) return after;
    await this.revision(updated, ctx, null);
    await this.audit.record({ action: 'UPDATE', summary: `Updated ${this.entityName} "${this.titleOf(updated)}"`, entityType: this.entityName, entityId: id, diff, ...this.actor(ctx) });
    this.emit(updated, existing);
    return after;
  }

  async softDelete(id: string, ctx: CrudContext): Promise<void> {
    const row = await this.findOrFail(id);
    await this.db.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
    await this.audit.record({ action: 'DELETE', summary: `Moved ${this.entityName} "${this.titleOf(row)}" to trash`, entityType: this.entityName, entityId: id, ...this.actor(ctx) });
    this.emit(row);
  }

  async restore(id: string, ctx: CrudContext) {
    const row = await this.findOrFail(id, true);
    const restored = await this.db.update({ where: { id }, data: { deletedAt: null, version: { increment: 1 } } });
    await this.audit.record({ action: 'RESTORE', summary: `Restored ${this.entityName} from trash`, entityType: this.entityName, entityId: id, ...this.actor(ctx) });
    this.emit(restored, row);
    return this.dto(await this.findOrFail(id));
  }

  async purge(id: string, ctx: CrudContext): Promise<void> {
    const row = await this.findOrFail(id, true);
    await this.refs.remove(this.entityName, id);
    await this.db.delete({ where: { id } });
    await this.audit.record({ action: 'PURGE', summary: `Purged ${this.entityName} "${this.titleOf(row)}"`, entityType: this.entityName, entityId: id, ...this.actor(ctx) });
    this.emit(row);
  }

  async transition(id: string, action: Action, ctx: CrudContext, scheduledAt?: Date) {
    if (!this.publishable) throw new ApiError(409, 'CONFLICT', `${this.entityName} has no publish workflow`);
    const row = await this.findOrFail(id);
    const now = new Date();
    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (action === 'publish') {
      await this.validatePublish(row);
      Object.assign(data, { status: 'PUBLISHED', publishedAt: row.publishedAt ?? now, scheduledAt: null });
    } else if (action === 'unpublish') {
      Object.assign(data, { status: 'DRAFT', scheduledAt: null });
    } else if (action === 'archive') {
      Object.assign(data, { status: 'ARCHIVED', scheduledAt: null });
    } else {
      if (!scheduledAt || scheduledAt.getTime() <= now.getTime()) {
        throw ApiError.validation([{ field: 'scheduledAt', message: 'Scheduled time must be in the future' }]);
      }
      await this.validatePublish(row);
      Object.assign(data, { status: 'SCHEDULED', scheduledAt });
    }
    const updated = (await this.db.update({ where: { id }, data })) as Row;
    await this.revision(updated, ctx, `Status: ${action}`);
    const auditAction = action === 'publish' ? 'PUBLISH' : action === 'unpublish' ? 'UNPUBLISH' : action === 'archive' ? 'ARCHIVE' : 'SCHEDULE';
    await this.audit.record({ action: auditAction, summary: `${action} ${this.entityName} "${this.titleOf(updated)}"`, entityType: this.entityName, entityId: id, ...this.actor(ctx) });
    this.emit(updated);
    return this.dto(await this.findOrFail(id));
  }

  async reorder(ids: string[], ctx: CrudContext): Promise<void> {
    const live = (await this.db.findMany({ select: { id: true } })) as Array<{ id: string }>;
    const liveSet = new Set(live.map((r) => r.id));
    const requested = new Set(ids);
    if (ids.length !== requested.size || ids.length !== liveSet.size || [...liveSet].some((x) => !requested.has(x))) {
      throw ApiError.validation([{ field: 'ids', message: 'ids must list every item exactly once' }]);
    }
    await this.prisma.client.$transaction(ids.map((id, i) => this.db.update({ where: { id }, data: { sortOrder: i } })));
    await this.audit.record({ action: 'REORDER', summary: `Reordered ${this.entityName}`, entityType: this.entityName, ...this.actor(ctx) });
    const set = this.tags({ id: '' } as Row);
    this.revalidation.enqueue(set.tags, set.paths);
  }

  async revisions(id: string) {
    await this.findOrFail(id, false);
    const rows = await this.prisma.client.contentRevision.findMany({
      where: { entityType: this.entityName, entityId: id },
      orderBy: { versionNo: 'desc' },
      take: 50,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        versionNo: r.versionNo,
        changeNote: r.changeNote,
        author: r.authorName ? { id: r.authorId, name: r.authorName } : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // ------------------------------------------------------------------ helpers

  /** Models with actor columns (createdById/updatedById); others omit them. */
  private static readonly ACTOR_MODELS = new Set(['product', 'brand', 'service', 'page', 'post']);

  protected actorColumns(ctx: CrudContext, creating: boolean): Record<string, unknown> {
    if (!PublishableCrud.ACTOR_MODELS.has(this.delegate)) return {};
    return creating ? { createdById: ctx.userId, updatedById: ctx.userId } : { updatedById: ctx.userId };
  }

  protected actor(ctx: CrudContext) {
    return { actorId: ctx.userId, actorEmail: ctx.email, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId };
  }

  protected titleOf(row: Row): string {
    return String(row.title ?? row.name ?? row.quote ?? row.question ?? row.heading ?? row.id);
  }

  protected async revision(row: Row, ctx: CrudContext, note: string | null): Promise<void> {
    const snapshot = await this.dto(row);
    const last = await this.prisma.client.contentRevision.findFirst({
      where: { entityType: this.entityName, entityId: row.id },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true },
    });
    const versionNo = (last?.versionNo ?? 0) + 1;
    await this.prisma.client.contentRevision.create({
      data: {
        entityType: this.entityName,
        entityId: row.id,
        versionNo,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
        changeNote: note,
        authorId: ctx.userId,
        authorName: ctx.email,
      },
    });
    if (versionNo > 50) {
      await this.prisma.client.contentRevision.deleteMany({
        where: { entityType: this.entityName, entityId: row.id, versionNo: { lte: versionNo - 50 } },
      });
    }
  }

  protected emit(row: Row, before?: Row): void {
    const set = this.tags(row);
    const tags = [...set.tags];
    const paths = [...set.paths];
    if (before && before.slug && before.slug !== row.slug) {
      const old = this.tags({ ...row, slug: before.slug } as Row);
      tags.push(...old.tags);
      paths.push(...old.paths);
    }
    this.revalidation.enqueue([...new Set(tags)], [...new Set(paths)]);
  }
}

/** Field-level diff of two DTOs (rich text is clipped by the audit writer). */
export function diffOf(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (['updatedAt', 'version', 'warnings', 'usage', 'revisions', 'usageCount'].includes(k)) continue;
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out[k] = [a[k] ?? null, b[k] ?? null];
  }
  return out;
}
