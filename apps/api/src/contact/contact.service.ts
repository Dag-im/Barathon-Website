import { Inject, Injectable, Logger } from '@nestjs/common';
import { MessageStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../common/utils/errors';
import { RateWindow } from '../common/utils/rate-window';
import { plainText } from '../common/utils/sanitize';
import { AppConfig, APP_CONFIG } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { randomBytes } from 'crypto';

const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const PHONE = /^[+0-9 ()\-.]{6,40}$/;
const DISPOSABLE = new Set(['mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com']);
const SPAM_PHRASES = ['crypto profit', 'guaranteed income', 'click here now', 'casino', 'viagra', 'loan approval'];

export const submitContactSchema = z
  .object({
    name: z.string().trim().min(2).max(120).refine((v) => !control.test(v), 'Control characters are not allowed'),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().regex(PHONE, 'Use digits and + ( ) - . only').optional(),
    message: z.string().trim().min(10).max(5000),
    subject: z.string().trim().max(160).optional(),
    productSlug: z.string().max(96).optional(),
    sourcePath: z.string().startsWith('/').max(300).optional(),
    consent: z.boolean().optional(),
    website: z.string().max(200).optional(),
    formStartedAt: z.number().int().optional(),
    captchaToken: z.string().max(2048).optional(),
  })
  .strict();

export type SubmitContactDto = z.infer<typeof submitContactSchema>;

/** Base-36 reference "BT-yymmdd-XXXX" (checklist 124). */
export function makeReference(now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let suffix = '';
  for (const b of randomBytes(4)) suffix += alphabet[b % 36];
  return `BT-${yy}${mm}${dd}-${suffix}`;
}

/** Spam scoring (backend-plan 7.2 step 6). Messages scoring at least 5 are stored as SPAM. */
export function scoreSpam(input: { message: string; email: string; name: string; ipDuplicate: boolean; emailBlocked: boolean }): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const links = (input.message.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links > 2) {
    score += 2;
    reasons.push('many-links');
  }
  const lower = input.message.toLowerCase();
  if (SPAM_PHRASES.some((p) => lower.includes(p))) {
    score += 2;
    reasons.push('spam-phrase');
  }
  if (DISPOSABLE.has(input.email.split('@')[1] ?? '')) {
    score += 2;
    reasons.push('disposable-domain');
  }
  if (/\d/.test(input.name) && input.email.split('@')[0] === input.name.toLowerCase()) {
    score += 1;
    reasons.push('name-equals-email');
  }
  if (input.ipDuplicate) {
    score += 3;
    reasons.push('duplicate-message');
  }
  if (input.emailBlocked) {
    score += 5;
    reasons.push('blocked-sender');
  }
  if (input.message.length < 15 && /https?:\/\//i.test(input.message)) {
    score += 2;
    reasons.push('short-link');
  }
  return { score, reasons };
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger('Contact');
  private readonly ipHour = new RateWindow(5, 3_600_000);
  private readonly ipDay = new RateWindow(20, 86_400_000);
  private readonly emailHour = new RateWindow(3, 3_600_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  private throttle(ip: string | null, email: string): void {
    if (!this.config.env.RATE_LIMITS_ENABLED) return;
    const key = ip ?? 'unknown';
    if (!this.ipHour.hit(key) || !this.ipDay.hit(key)) throw ApiError.tooMany(this.ipHour.retryAfter(key));
    if (!this.emailHour.hit(email)) throw ApiError.tooMany(this.emailHour.retryAfter(email));
  }

  /** Verifies a captcha token; returns 'ok' | 'failed' | 'unavailable'. */
  private async verifyCaptcha(provider: string, token: string | undefined, ip: string | null): Promise<'ok' | 'failed' | 'unavailable'> {
    const secret = this.config.env.CAPTCHA_SECRET;
    if (!token || !secret) return 'failed';
    const url = provider === 'TURNSTILE' ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify' : 'https://hcaptcha.com/siteverify';
    try {
      const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
      const res = await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(3000) });
      const json = (await res.json()) as { success?: boolean };
      return json.success ? 'ok' : 'failed';
    } catch {
      return 'unavailable';
    }
  }

  async submit(raw: unknown, ctx: RequestContext) {
    const parsed = submitContactSchema.safeParse(raw);
    if (!parsed.success) {
      throw ApiError.validation(parsed.error.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message, code: i.code })));
    }
    const dto = parsed.data;
    const successMessage = ((await this.settings.publicCore()).contactForm as { successMessage?: string }).successMessage ?? 'Thank you.';
    const emptyResponse = { id: null, reference: null, message: successMessage };

    // Honeypot: bots learn nothing from the response.
    if (dto.website && dto.website.length > 0) {
      this.logger.warn('honeypot triggered');
      return emptyResponse;
    }

    this.throttle(ctx.ip, dto.email);

    const siteCfg = await this.settings.row();
    const contactForm = siteCfg.contactForm as { consentRequired?: boolean; captchaProvider?: string };
    if (contactForm.consentRequired && dto.consent !== true) {
      throw ApiError.validation([{ field: 'consent', message: 'Consent is required' }]);
    }

    let spamBoost = 0;
    if (contactForm.captchaProvider && contactForm.captchaProvider !== 'NONE') {
      const verdict = await this.verifyCaptcha(contactForm.captchaProvider, dto.captchaToken, ctx.ip);
      if (verdict === 'failed') throw new ApiError(403, 'CAPTCHA_FAILED', 'Captcha verification failed');
      if (verdict === 'unavailable') {
        spamBoost = 3;
        this.logger.warn('captcha provider unavailable; accepting with spam score +3');
      }
    }

    const timeTrapped = dto.formStartedAt !== undefined && Date.now() - dto.formStartedAt < 3000;
    const recent = ctx.ip
      ? await this.db.contactMessage.count({ where: { ip: ctx.ip, message: dto.message, createdAt: { gt: new Date(Date.now() - 86_400_000) } } })
      : 0;
    const emailBlocked = await this.db.contactMessage.count({ where: { email: dto.email, status: 'SPAM' } }).then((n) => n >= 3);
    const scored = scoreSpam({ message: dto.message, email: dto.email, name: dto.name, ipDuplicate: recent > 0, emailBlocked });
    const score = scored.score + spamBoost + (timeTrapped ? 5 : 0);
    const reasons = [...scored.reasons, ...(timeTrapped ? ['time-trap'] : [])];
    const isSpam = score >= 5;

    let productId: string | null = null;
    let productTitle: string | null = null;
    if (dto.productSlug) {
      const product = await this.db.product.findFirst({ where: { slug: dto.productSlug.toLowerCase(), deletedAt: null }, select: { id: true, title: true } });
      if (product) {
        productId = product.id;
        productTitle = product.title;
      }
    }

    let reference = makeReference();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const row = await this.db.contactMessage.create({
          data: {
            reference,
            name: plainText(dto.name),
            email: dto.email,
            phone: dto.phone ?? null,
            message: plainText(dto.message).slice(0, 5000),
            subject: dto.subject ? plainText(dto.subject) : null,
            productId,
            productTitleSnapshot: productTitle,
            sourcePath: dto.sourcePath ?? null,
            consentGiven: dto.consent ?? null,
            status: isSpam ? MessageStatus.SPAM : MessageStatus.NEW,
            spamScore: Math.min(score, 32767),
            spamReasons: reasons,
            ip: ctx.ip,
            userAgent: ctx.userAgent?.slice(0, 400) ?? null,
          },
        });
        return { id: row.id, reference: row.reference, message: successMessage };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          reference = makeReference();
          continue;
        }
        throw err;
      }
    }
    throw ApiError.conflict('CONFLICT', 'Could not store the message, please retry');
  }

  async audited(action: 'MESSAGE_STATUS' | 'MESSAGE_NOTE', summary: string, entityId: string, ctx: RequestContext & { userId: string; email: string }) {
    await this.audit.record({ action, summary, entityType: 'ContactMessage', entityId, actorId: ctx.userId, actorEmail: ctx.email, ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId });
  }

  /** Shapes a message for the admin API, with plain-text fields only. */
  listItem(m: any) {
    return {
      id: m.id,
      reference: m.reference,
      name: m.name,
      email: m.email,
      phone: m.phone,
      excerpt: m.message.slice(0, 140),
      status: m.status,
      isStarred: m.isStarred,
      productTitle: m.productTitleSnapshot ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }

  dto(m: any) {
    return {
      ...this.listItem(m),
      message: m.message,
      subject: m.subject,
      sourcePath: m.sourcePath,
      ip: m.ip,
      userAgent: m.userAgent,
      spamScore: m.spamScore,
      spamReasons: m.spamReasons,
      notificationStatus: 'NOT_SENT',
      notes: (m.notes ?? []).map((n: any) => ({ id: n.id, kind: n.kind, body: n.body, author: n.authorName ? { id: n.authorId, name: n.authorName } : null, createdAt: n.createdAt.toISOString() })),
      readAt: m.readAt?.toISOString() ?? null,
      repliedAt: m.repliedAt?.toISOString() ?? null,
    };
  }
}

/** Neutralises spreadsheet formulas in CSV cells (checklist 132). */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
