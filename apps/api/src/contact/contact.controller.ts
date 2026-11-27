import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { MessageStatus } from '@prisma/client';
import { Public } from '../common/decorators/access.decorators';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { parse } from '../common/content/crud.controller';
import { requestContext } from '../auth/auth.types';
import { ApiError } from '../common/utils/errors';
import { paged, skipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ContactService, csvCell } from './contact.service';

const statusList = z.string().optional().transform((v) => (v ? (v.split(',').map((s) => s.trim()).filter(Boolean) as MessageStatus[]) : undefined));
const messageQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: statusList,
    starred: z.enum(['true', 'false']).optional(),
    q: z.string().max(120).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    productId: z.string().uuid().optional(),
    sort: z.enum(['-createdAt', 'createdAt']).default('-createdAt'),
  })
  .strict();

function whereOf(q: z.infer<typeof messageQuery>) {
  const where: Record<string, unknown> = {};
  if (q.status?.length) where.status = { in: q.status };
  else where.status = { in: ['NEW', 'READ', 'REPLIED'] };
  if (q.starred) where.isStarred = q.starred === 'true';
  if (q.productId) where.productId = q.productId;
  if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
  if (q.q) where.OR = [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { message: { contains: q.q, mode: 'insensitive' } }];
  return where;
}

@ApiTags('public-contact')
@Controller('public')
export class ContactPublicController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  submit(@Body() body: unknown, @Req() req: Request) {
    return this.contact.submit(body, requestContext(req));
  }

  @Public()
  @Post('contact-messages')
  @HttpCode(HttpStatus.CREATED)
  submitAlias(@Body() body: unknown, @Req() req: Request) {
    return this.contact.submit(body, requestContext(req));
  }
}

@ApiTags('admin-messages')
@Controller('admin/messages')
export class MessagesAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contact: ContactService,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  @Get('unread-count')
  async unread() {
    return { count: await this.db.contactMessage.count({ where: { status: 'NEW' } }) };
  }

  @Get('export.csv')
  async exportCsv(@Query() query: unknown, @Res() res: Response): Promise<void> {
    const q = parse(messageQuery, query);
    const rows = await this.db.contactMessage.findMany({ where: whereOf(q), orderBy: { createdAt: 'desc' }, take: 5000 });
    const header = ['reference', 'createdAt', 'status', 'name', 'email', 'phone', 'product', 'message'];
    const lines = [header.join(','), ...rows.map((r: any) => [r.reference, r.createdAt.toISOString(), r.status, r.name, r.email, r.phone, r.productTitleSnapshot, r.message].map(csvCell).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="messages.csv"');
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  }

  @Get()
  async list(@Query() query: unknown) {
    const q = parse(messageQuery, query);
    const where = whereOf(q);
    const [rows, total, counts] = await Promise.all([
      this.db.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q.page, q.pageSize) }),
      this.db.contactMessage.count({ where }),
      this.db.contactMessage.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const byStatus = Object.fromEntries(['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM'].map((s) => [s, 0])) as Record<string, number>;
    for (const c of counts) byStatus[c.status] = c._count._all;
    const page = paged(rows.map((r: any) => this.contact.listItem(r)), total, q.page, q.pageSize);
    return { ...page, meta: { ...page.meta, counts: byStatus } };
  }

  @Get(':id')
  async get(@Param('id') id: string, @Query('markRead') markRead?: string) {
    const row = await this.db.contactMessage.findFirst({ where: { id }, include: { notes: { orderBy: { createdAt: 'asc' } } } });
    if (!row) throw ApiError.notFound('Message');
    if (row.status === 'NEW' && markRead !== 'false') {
      const updated = await this.db.contactMessage.update({ where: { id }, data: { status: 'READ', readAt: new Date() }, include: { notes: { orderBy: { createdAt: 'asc' } } } });
      return this.contact.dto(updated);
    }
    return this.contact.dto(row);
  }

  @Patch(':id')
  async patch(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const b = parse(z.object({ status: z.nativeEnum(MessageStatus).optional(), isStarred: z.boolean().optional() }).strict(), body);
    const current = await this.db.contactMessage.findFirst({ where: { id } });
    if (!current) throw ApiError.notFound('Message');
    const data: Record<string, unknown> = { ...(b.isStarred !== undefined ? { isStarred: b.isStarred } : {}) };
    if (b.status) {
      data.status = b.status;
      if (b.status === 'ARCHIVED') data.archivedAt = new Date();
      if (b.status === 'REPLIED') data.repliedAt = new Date();
      if (b.status === 'READ' && !current.readAt) data.readAt = new Date();
    }
    const row = await this.db.contactMessage.update({ where: { id }, data, include: { notes: { orderBy: { createdAt: 'asc' } } } });
    if (b.status && b.status !== current.status) {
      await this.contact.audited('MESSAGE_STATUS', `Message ${current.reference} ${current.status} -> ${b.status}`, id, { ...requestContext(req), userId: user.id, email: user.email });
    }
    return this.contact.dto(row);
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  async addNote(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthUser) {
    const { body: text } = parse(z.object({ body: z.string().trim().min(1).max(2000) }).strict(), body);
    if (!(await this.db.contactMessage.findFirst({ where: { id } }))) throw ApiError.notFound('Message');
    return this.db.contactMessage.findFirst({ where: { id } }).then(async () => {
      const note = await this.db.contactMessageNote.create({ data: { messageId: id, body: text, kind: 'NOTE', authorId: user.id, authorName: user.email } });
      return { id: note.id, kind: note.kind, body: note.body, author: { id: user.id, name: user.email }, createdAt: note.createdAt.toISOString() };
    });
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(@Param('id') id: string, @Param('noteId') noteId: string): Promise<void> {
    const r = await this.db.contactMessageNote.deleteMany({ where: { id: noteId, messageId: id } });
    if (!r.count) throw ApiError.notFound('Note');
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulk(@Body() body: unknown) {
    const b = parse(z.object({ ids: z.array(z.string().uuid()).min(1).max(200), action: z.enum(['read', 'archive', 'spam', 'delete', 'star', 'unstar']) }).strict(), body);
    let data: Record<string, unknown> | null = null;
    switch (b.action) {
      case 'read':
        data = { status: 'READ', readAt: new Date() };
        break;
      case 'archive':
        data = { status: 'ARCHIVED', archivedAt: new Date() };
        break;
      case 'spam':
        data = { status: 'SPAM' };
        break;
      case 'star':
        data = { isStarred: true };
        break;
      case 'unstar':
        data = { isStarred: false };
        break;
      default:
        break;
    }
    if (b.action === 'delete') {
      const r = await this.db.contactMessage.deleteMany({ where: { id: { in: b.ids } } });
      return { affected: r.count };
    }
    const r = await this.db.contactMessage.updateMany({ where: { id: { in: b.ids } }, data: data ?? {} });
    return { affected: r.count };
  }

  @Post(':id/mark-spam')
  @HttpCode(HttpStatus.OK)
  async markSpam(@Param('id') id: string) {
    const row = await this.db.contactMessage.update({ where: { id }, data: { status: 'SPAM' }, include: { notes: true } });
    return this.contact.dto(row);
  }

  @Post(':id/not-spam')
  @HttpCode(HttpStatus.OK)
  async notSpam(@Param('id') id: string) {
    const row = await this.db.contactMessage.update({ where: { id }, data: { status: 'READ', readAt: new Date() }, include: { notes: true } });
    return this.contact.dto(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.db.contactMessage.delete({ where: { id } });
  }
}
