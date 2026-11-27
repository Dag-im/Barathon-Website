import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { RedirectMatch, RedirectType } from '@prisma/client';
import { Public } from '../common/decorators/access.decorators';
import { parse, listSchema } from '../common/content/crud.controller';
import { paged, skipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { RedirectsService, normalisePath } from './redirects.service';
import { ApiError } from '../common/utils/errors';

const redirectBody = z
  .object({
    sourcePath: z.string().min(1).max(500),
    targetPath: z.string().min(1).max(1000),
    type: z.nativeEnum(RedirectType).optional(),
    matchType: z.nativeEnum(RedirectMatch).optional(),
    note: z.string().max(200).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

@ApiTags('redirects')
@Controller()
export class RedirectsController {
  constructor(
    private readonly redirects: RedirectsService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------- public

  @Public()
  @Get('public/redirects')
  rules() {
    return this.redirects.enabledRules().then((data) => ({ data }));
  }

  @Public()
  @Get('public/redirects/resolve')
  async resolve(@Query('path') path: string) {
    if (!path) throw ApiError.validation([{ field: 'path', message: 'path is required' }]);
    return this.redirects.resolve(path);
  }

  // ---------------------------------------------------------- admin

  @Get('admin/redirects')
  async list(@Query() query: unknown) {
    const q = parse(listSchema, query);
    const where = q.q ? { OR: [{ sourcePath: { contains: q.q.toLowerCase() } }, { targetPath: { contains: q.q } }] } : {};
    const [rows, total] = await Promise.all([
      this.prisma.client.redirect.findMany({ where, orderBy: { sourcePath: 'asc' }, ...skipTake(q.page, q.pageSize) }),
      this.prisma.client.redirect.count({ where }),
    ]);
    return paged(rows, total, q.page, q.pageSize);
  }

  @Post('admin/redirects')
  create(@Body() body: unknown) {
    return this.redirects.create(parse(redirectBody, body));
  }

  @Patch('admin/redirects/:id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const b = parse(redirectBody.partial(), body);
    const current = await this.prisma.client.redirect.findUnique({ where: { id } });
    if (!current) throw ApiError.notFound('Redirect');
    const source = b.sourcePath ? normalisePath(b.sourcePath) : current.sourcePath;
    const target = b.targetPath ? this.redirects.validateTarget(b.targetPath, source) : current.targetPath;
    if (target !== current.targetPath) await this.redirects.assertNoLoop(source, target);
    return this.prisma.client.redirect.update({
      where: { id },
      data: { sourcePath: source, targetPath: target, type: b.type, matchType: b.matchType, note: b.note, enabled: b.enabled },
    });
  }

  @Delete('admin/redirects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.prisma.client.redirect.delete({ where: { id } });
  }

  @Post('admin/redirects/test')
  @HttpCode(HttpStatus.OK)
  test(@Body() body: unknown) {
    const { path } = parse(z.object({ path: z.string().min(1).max(1000) }).strict(), body);
    return this.redirects.chain(path);
  }

  @Get('admin/redirects/export.csv')
  async exportCsv(@Res() res: Response): Promise<void> {
    const rows = await this.prisma.client.redirect.findMany({ orderBy: { sourcePath: 'asc' } });
    const lines = ['source,target,type,match', ...rows.map((r: { sourcePath: string; targetPath: string; type: string; matchType: string }) => [r.sourcePath, r.targetPath, r.type, r.matchType].map(csvCell).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(`﻿${lines.join('\n')}\n`);
  }

  @Post('admin/redirects/import')
  @HttpCode(HttpStatus.OK)
  async importCsv(@Body() body: unknown, @Query('dryRun') dryRun?: string) {
    const { csv } = parse(z.object({ csv: z.string().max(200_000) }).strict(), body);
    const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.slice(1, 1001).map((l) => l.split(',').map((c) => c.trim()));
    const results: Array<{ row: number; ok: boolean; error?: string }> = [];
    for (const [i, [source, target, type, match]] of rows.entries()) {
      try {
        if (dryRun === 'false') {
          await this.redirects.create({
            sourcePath: source,
            targetPath: target,
            type: (type as RedirectType) || undefined,
            matchType: (match as RedirectMatch) || undefined,
          });
        } else {
          this.redirects.validateTarget(target ?? '', normalisePath(source ?? ''));
        }
        results.push({ row: i + 2, ok: true });
      } catch (err) {
        results.push({ row: i + 2, ok: false, error: (err as Error).message });
      }
    }
    return { dryRun: dryRun !== 'false', rows: results.length, errors: results.filter((r) => !r.ok), data: results };
  }
}

function csvCell(v: string): string {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export { Req };
