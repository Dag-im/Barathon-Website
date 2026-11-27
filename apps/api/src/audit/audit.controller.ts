import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { zodPipe } from '../common/pipes/zod.pipe';
import { paginationSchema, paged, skipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

const auditQuery = paginationSchema.extend({
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(64).optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().max(120).optional(),
}).strict();

@ApiTags('admin-audit')
@Controller('admin/audit-logs')
export class AuditAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Query the audit log' })
  async list(@Query(zodPipe(auditQuery)) q: z.infer<typeof auditQuery>) {
    const where = {
      ...(q.action ? { action: q.action } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.q ? { summary: { contains: q.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q.page, q.pageSize) }),
      this.prisma.client.auditLog.count({ where }),
    ]);
    return paged(
      rows.map((r) => ({
        id: r.id.toString(),
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        summary: r.summary,
        diff: r.diff,
        actorEmail: r.actorEmail,
        ip: r.ip,
        requestId: r.requestId,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      q.page,
      q.pageSize,
    );
  }
}
