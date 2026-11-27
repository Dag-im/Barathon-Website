import { Body, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z, ZodTypeAny } from 'zod';
import { AuthUser, CurrentUser } from '../decorators/current-user.decorator';
import { requestContext } from '../../auth/auth.types';
import { ApiError } from '../utils/errors';
import { PublishableCrud, CrudContext, Action } from './content-crud';

export const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).strict();
export const scheduleSchema = z.object({ scheduledAt: z.coerce.date() }).strict();
export const bulkSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.enum(['publish', 'unpublish', 'archive', 'delete', 'restore']),
  })
  .strict();

export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().max(120).optional(),
    status: z.string().optional(),
    deleted: z.enum(['true', 'false']).optional(),
    sort: z.string().max(40).optional(),
  })
  .strict();

/** Parses a request body or query with a zod schema (422 on failure). */
export function parse<T extends ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const r = schema.safeParse(value ?? {});
  if (!r.success) {
    throw ApiError.validation(r.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message, code: i.code })));
  }
  return r.data;
}

export function crudContext(req: Request, user: AuthUser): CrudContext {
  return { ...requestContext(req), userId: user.id, email: user.email };
}

/**
 * Standard admin routes for a publishable resource (backend-plan 6.3.0). Subclasses set the
 * service and the zod schemas and may add routes. Declaration order matters: /reorder and
 * /bulk are declared before /:id.
 */
export abstract class CrudAdminController {
  protected abstract readonly crud: PublishableCrud<any>;
  protected abstract readonly createSchema: ZodTypeAny;
  protected abstract readonly updateSchema: ZodTypeAny;

  @Get()
  list(@Query() query: unknown) {
    const q = parse(listSchema, query);
    return this.crud.list({
      q: q.q,
      status: q.status ? q.status.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      deleted: q.deleted === 'true',
      page: q.page,
      pageSize: q.pageSize,
      sort: q.sort,
    });
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.crud.create(parse(this.createSchema, body) as Record<string, unknown>, crudContext(req, user));
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  async reorder(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.crud.reorder(parse(reorderSchema, body).ids, crudContext(req, user));
    return { ok: true };
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulk(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const b = parse(bulkSchema, body);
    const ctx = crudContext(req, user);
    let affected = 0;
    for (const id of b.ids) {
      try {
        if (b.action === 'delete') await this.crud.softDelete(id, ctx);
        else if (b.action === 'restore') await this.crud.restore(id, ctx);
        else await this.crud.transition(id, b.action as Action, ctx);
        affected += 1;
      } catch {
        // Items that cannot take the action are skipped and not counted.
      }
    }
    return { affected };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.crud.getDto(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.crud.update(id, parse(this.updateSchema, body) as Record<string, unknown>, crudContext(req, user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    await this.crud.softDelete(id, crudContext(req, user));
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.crud.restore(id, crudContext(req, user));
  }

  @Delete(':id/purge')
  @HttpCode(HttpStatus.NO_CONTENT)
  async purge(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    await this.crud.purge(id, crudContext(req, user));
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.crud.transition(id, 'publish', crudContext(req, user));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.crud.transition(id, 'unpublish', crudContext(req, user));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.crud.transition(id, 'archive', crudContext(req, user));
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  schedule(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const b = parse(scheduleSchema, body);
    return this.crud.transition(id, 'schedule', crudContext(req, user), b.scheduledAt);
  }

  @Get(':id/revisions')
  revisions(@Param('id') id: string) {
    return this.crud.revisions(id);
  }
}
