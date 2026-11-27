import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  action: AuditAction;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  diff?: Record<string, [unknown, unknown]> | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

const SECRET_KEY = /(password|hash|token|secret|code|totp)/i;
const MAX_RICH = 500;

/** Removes secrets and truncates long text before a diff is persisted. */
export function sanitizeDiff(diff: Record<string, [unknown, unknown]> | null | undefined): Prisma.InputJsonValue | undefined {
  if (!diff) return undefined;
  const out: Record<string, [unknown, unknown]> = {};
  for (const [field, pair] of Object.entries(diff)) {
    if (SECRET_KEY.test(field)) continue;
    const clip = (v: unknown): unknown => (typeof v === 'string' && v.length > MAX_RICH ? `${v.slice(0, MAX_RICH)}...` : v);
    out[field] = [clip(pair[0]), clip(pair[1])];
  }
  return out as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    try {
      await this.prisma.client.auditLog.create({
        data: {
          action: input.action,
          summary: input.summary.slice(0, 300),
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          actorId: input.actorId ?? null,
          actorEmail: input.actorEmail ?? null,
          diff: sanitizeDiff(input.diff) ?? Prisma.JsonNull,
          ip: input.ip ?? null,
          userAgent: input.userAgent?.slice(0, 400) ?? null,
          requestId: input.requestId ?? null,
        },
      });
    } catch (err) {
      // Auditing must never break the business write that triggered it.
      this.logger.error({ err: (err as Error).message, action: input.action }, 'audit write failed');
    }
  }
}
