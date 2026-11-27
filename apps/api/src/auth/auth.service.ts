import { Inject, Injectable } from '@nestjs/common';
import { AuditAction, Prisma, User } from '@prisma/client';
import { randomToken } from '../common/utils/crypto';
import { ApiError } from '../common/utils/errors';
import { RateWindow } from '../common/utils/rate-window';
import { AppConfig, APP_CONFIG } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService, PASSWORD_HISTORY_SIZE } from './password.service';
import { TokenService } from './token.service';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { deviceLabel, FORGOT_MESSAGE, RequestContext } from './auth.types';

const REUSE_RACE_WINDOW_MS = 10_000;
const LOCK_CAP_MINUTES = 24 * 60;

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  refreshValue: string;
  csrfToken: string;
}

export interface ValidatedRefresh {
  session: Prisma.AuthSessionGetPayload<object>;
  token: Prisma.RefreshTokenGetPayload<object>;
  user: User;
}

@Injectable()
export class AuthService {
  private readonly loginPairLimiter: RateWindow;
  private readonly forgotIpLimiter = new RateWindow(3, 3_600_000);
  private readonly forgotGlobalLimiter = new RateWindow(5, 3_600_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.loginPairLimiter = new RateWindow(5, 15 * 60_000);
  }

  private get db() {
    return this.prisma.client;
  }

  private get limitsEnabled(): boolean {
    return this.config.env.RATE_LIMITS_ENABLED;
  }

  /** Enforces the 5 per 15 minutes per (ip, email) login limit. */
  checkLoginPair(ip: string | null, email: string): void {
    if (!this.limitsEnabled) return;
    const key = `${ip ?? 'unknown'}|${email}`;
    if (!this.loginPairLimiter.hit(key)) {
      throw ApiError.tooMany(this.loginPairLimiter.retryAfter(key));
    }
  }

  // ------------------------------------------------------------------ sessions

  private async createSession(user: User, ctx: RequestContext): Promise<IssuedSession> {
    const now = Date.now();
    const idleExpiresAt = new Date(now + this.config.refreshIdleMs);
    const absoluteExpiresAt = new Date(now + this.config.sessionAbsoluteMs);
    const session = await this.db.authSession.create({
      data: {
        userId: user.id,
        userAgent: ctx.userAgent?.slice(0, 400) ?? null,
        deviceLabel: deviceLabel(ctx.userAgent),
        ip: ctx.ip,
        idleExpiresAt,
        absoluteExpiresAt,
      },
    });
    const { secret, hash } = this.tokens.newRefreshSecret();
    await this.db.refreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: hash,
        expiresAt: new Date(Math.min(idleExpiresAt.getTime(), absoluteExpiresAt.getTime())),
      },
    });
    return this.tokensFor(user, session.id, this.tokens.formatRefresh(session.id, secret));
  }

  private tokensFor(user: User, sessionId: string, refreshValue: string): IssuedSession {
    return {
      sessionId,
      accessToken: this.tokens.signAccess({ sub: user.id, sid: sessionId, role: 'ADMIN', tv: user.tokenVersion }),
      refreshValue,
      csrfToken: randomToken(32),
    };
  }

  // ------------------------------------------------------------------ login

  async login(dto: LoginDto, ctx: RequestContext): Promise<{ user: User; issued: IssuedSession }> {
    this.checkLoginPair(ctx.ip, dto.email);
    const user = await this.db.user.findFirst({ where: { email: dto.email } });

    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        summary: `Failed login for unknown account ${dto.email}`,
        ...ctx,
      });
      throw ApiError.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw ApiError.locked(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000));
    }

    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.registerFailure(user, ctx);
      throw ApiError.invalidCredentials();
    }
    if (!user.isActive) throw ApiError.invalidCredentials();

    const updates: Prisma.UserUpdateInput = {
      failedLoginCount: 0,
      lockCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ctx.ip,
    };
    if (this.passwords.needsRehash(user.passwordHash)) {
      updates.passwordHash = await this.passwords.hash(dto.password);
    }
    const updated = await this.db.user.update({ where: { id: user.id }, data: updates });

    const issued = await this.createSession(updated, ctx);
    await this.audit.record({
      action: AuditAction.LOGIN,
      summary: `Signed in as ${updated.email}`,
      entityType: 'User',
      entityId: updated.id,
      actorId: updated.id,
      actorEmail: updated.email,
      ...ctx,
    });
    return { user: updated, issued };
  }

  private async registerFailure(user: User, ctx: RequestContext): Promise<void> {
    const failures = user.failedLoginCount + 1;
    const locking = failures >= this.config.env.LOGIN_MAX_FAILURES;
    if (locking) {
      const lockCount = user.lockCount + 1;
      const minutes = Math.min(this.config.env.LOCKOUT_BASE_MINUTES * 2 ** (lockCount - 1), LOCK_CAP_MINUTES);
      await this.db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockCount, lockedUntil: new Date(Date.now() + minutes * 60_000) },
      });
      await this.audit.record({
        action: AuditAction.ACCOUNT_LOCKED,
        summary: `Account ${user.email} locked for ${minutes} minutes after repeated failures`,
        entityType: 'User',
        entityId: user.id,
        actorEmail: user.email,
        ...ctx,
      });
    } else {
      await this.db.user.update({ where: { id: user.id }, data: { failedLoginCount: failures } });
    }
    await this.audit.record({
      action: AuditAction.LOGIN_FAILED,
      summary: `Failed login for ${user.email}`,
      entityType: 'User',
      entityId: user.id,
      actorEmail: user.email,
      ...ctx,
    });
  }

  // ------------------------------------------------------------------ refresh

  /** Validates the refresh cookie and applies the race and reuse rules (backend-plan 4.3.3). */
  async validateRefresh(value: string | undefined, ctx: RequestContext): Promise<ValidatedRefresh> {
    const parsed = value ? this.tokens.parseRefresh(value) : null;
    if (!parsed) throw ApiError.refreshInvalid();

    const token = await this.db.refreshToken.findFirst({
      where: { tokenHash: this.tokens.hash(parsed.secret) },
      include: { session: { include: { user: true } } },
    });
    if (!token || token.sessionId !== parsed.sessionId) throw ApiError.refreshInvalid();

    const { session } = token;
    const now = Date.now();
    if (
      session.revokedAt ||
      session.idleExpiresAt.getTime() <= now ||
      session.absoluteExpiresAt.getTime() <= now ||
      token.expiresAt.getTime() <= now ||
      !session.user.isActive
    ) {
      throw ApiError.refreshInvalid();
    }

    if (token.usedAt) {
      if (now - token.usedAt.getTime() <= REUSE_RACE_WINDOW_MS) {
        throw new ApiError(401, 'REFRESH_RACE', 'Refresh already in progress; retry shortly');
      }
      await this.revokeSession(session.id, 'REUSE_DETECTED');
      await this.audit.record({
        action: AuditAction.REFRESH_REUSE_DETECTED,
        summary: `Refresh token reuse detected; session ${session.id} revoked`,
        entityType: 'User',
        entityId: session.userId,
        actorId: session.userId,
        actorEmail: session.user.email,
        ...ctx,
      });
      throw new ApiError(401, 'REFRESH_REUSE', 'Session revoked because a refresh token was reused');
    }

    const { user, ...sessionRow } = session;
    return { session: sessionRow, token, user };
  }

  /** Rotates the refresh token: old one marked used, new one chained by parentId. */
  async rotate(valid: ValidatedRefresh): Promise<IssuedSession> {
    const { secret, hash } = this.tokens.newRefreshSecret();
    const now = new Date();
    const idle = new Date(now.getTime() + this.config.refreshIdleMs);
    const newIdle = new Date(Math.min(idle.getTime(), valid.session.absoluteExpiresAt.getTime()));
    await this.db.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: { sessionId: valid.session.id, tokenHash: hash, parentId: valid.token.id, expiresAt: newIdle },
      });
      await tx.refreshToken.update({
        where: { id: valid.token.id },
        data: { usedAt: now, replacedById: next.id },
      });
      await tx.authSession.update({
        where: { id: valid.session.id },
        data: { lastUsedAt: now, idleExpiresAt: newIdle },
      });
      return next;
    });
    return this.tokensFor(valid.user, valid.session.id, this.tokens.formatRefresh(valid.session.id, secret));
  }

  // ------------------------------------------------------------------ logout and sessions

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.db.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async logout(sessionId: string, ctx: RequestContext & { userId: string; email: string }): Promise<void> {
    await this.revokeSession(sessionId, 'LOGOUT');
    await this.audit.record({
      action: AuditAction.LOGOUT,
      summary: `Signed out of session ${sessionId}`,
      entityType: 'User',
      entityId: ctx.userId,
      actorId: ctx.userId,
      actorEmail: ctx.email,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  async logoutAll(userId: string, email: string, ctx: RequestContext): Promise<void> {
    await this.db.$transaction([
      this.db.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'LOGOUT_ALL' },
      }),
      this.db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ]);
    await this.audit.record({
      action: AuditAction.LOGOUT,
      summary: 'Signed out of all sessions',
      entityType: 'User',
      entityId: userId,
      actorId: userId,
      actorEmail: email,
      ...ctx,
    });
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.db.authSession.findMany({
      where: { userId, revokedAt: null, idleExpiresAt: { gt: new Date() }, absoluteExpiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  /** Returns true when the revoked session was the caller's current one. */
  async revokeOwnSession(userId: string, sessionId: string, currentSessionId: string, ctx: RequestContext, email: string): Promise<boolean> {
    const target = await this.db.authSession.findFirst({ where: { id: sessionId, userId } });
    if (!target) throw ApiError.notFound('Session');
    await this.revokeSession(sessionId, 'ADMIN');
    await this.audit.record({
      action: AuditAction.SESSION_REVOKE,
      summary: `Revoked session ${sessionId}`,
      entityType: 'User',
      entityId: userId,
      actorId: userId,
      actorEmail: email,
      ...ctx,
    });
    return sessionId === currentSessionId;
  }

  // ------------------------------------------------------------------ password flows

  async changePassword(
    user: User,
    sessionId: string,
    dto: ChangePasswordDto,
    ctx: RequestContext,
  ): Promise<IssuedSession> {
    const restricted = user.mustChangePassword;
    if (dto.confirmPassword !== undefined && dto.confirmPassword !== dto.newPassword) {
      throw ApiError.validation([{ field: 'confirmPassword', message: 'Passwords do not match', code: 'mismatch' }]);
    }

    if (!restricted) {
      if (!dto.currentPassword) {
        throw ApiError.validation([{ field: 'currentPassword', message: 'Current password is required', code: 'required' }]);
      }
      const ok = await this.passwords.verify(user.passwordHash, dto.currentPassword);
      if (!ok) {
        await this.registerFailure(user, ctx);
        throw ApiError.invalidCredentials();
      }
    }

    const emailLocal = user.email.split('@')[0];
    this.passwords.assertPolicy(dto.newPassword, emailLocal);

    if (restricted && dto.newPassword === this.config.env.ADMIN_RESET_PASSWORD) {
      throw ApiError.validation([{ field: 'newPassword', message: 'Choose a password different from the default', code: 'default_password' }]);
    }
    if (!restricted && dto.newPassword === dto.currentPassword) {
      throw ApiError.validation([{ field: 'newPassword', message: 'New password must differ from the current one', code: 'same' }]);
    }

    const history = await this.db.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_SIZE,
    });
    for (const entry of history) {
      if (await this.passwords.verify(entry.hash, dto.newPassword)) {
        throw ApiError.validation([{ field: 'newPassword', message: 'Password was used recently; choose another', code: 'reused' }]);
      }
    }

    const newHash = await this.passwords.hash(dto.newPassword);
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      await tx.passwordHistory.create({ data: { userId: user.id, hash: user.passwordHash } });
      const old = await tx.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: PASSWORD_HISTORY_SIZE,
        select: { id: true },
      });
      if (old.length) await tx.passwordHistory.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: sessionId } },
        data: { revokedAt: now, revokedReason: 'PASSWORD_CHANGE' },
      });
      return tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordChangedAt: now,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    });

    // Keep the current session alive with a fresh refresh token and access token.
    await this.db.refreshToken.updateMany({
      where: { sessionId, usedAt: null },
      data: { usedAt: now },
    });
    const { secret, hash } = this.tokens.newRefreshSecret();
    await this.db.refreshToken.create({
      data: { sessionId, tokenHash: hash, expiresAt: new Date(now.getTime() + this.config.refreshIdleMs) },
    });
    await this.audit.record({
      action: AuditAction.PASSWORD_CHANGE,
      summary: `Password changed for ${user.email}`,
      entityType: 'User',
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      ...ctx,
    });
    return this.tokensFor(updated, sessionId, this.tokens.formatRefresh(sessionId, secret));
  }

  /**
   * Forgot password: resets the admin account to the constant from ADMIN_RESET_PASSWORD.
   * Always returns the same message so the response never reveals whether the account exists.
   */
  async forgotPassword(identifier: string, ctx: RequestContext): Promise<string> {
    if (this.limitsEnabled) {
      const ipKey = ctx.ip ?? 'unknown';
      if (!this.forgotIpLimiter.hit(ipKey) || !this.forgotGlobalLimiter.hit('global')) {
        throw ApiError.tooMany(Math.max(this.forgotIpLimiter.retryAfter(ipKey), 1));
      }
    }
    const email = identifier.trim().toLowerCase();
    const user = await this.db.user.findFirst({ where: { email } });
    if (user && user.isActive) {
      const hash = await this.passwords.hash(this.config.env.ADMIN_RESET_PASSWORD);
      await this.db.$transaction([
        this.db.user.update({
          where: { id: user.id },
          data: {
            passwordHash: hash,
            passwordChangedAt: new Date(),
            mustChangePassword: true,
            tokenVersion: { increment: 1 },
            failedLoginCount: 0,
            lockedUntil: null,
          },
        }),
        this.db.authSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
        }),
      ]);
      await this.audit.record({
        action: AuditAction.PASSWORD_RESET,
        summary: `Password reset to the default for ${user.email} via forgot-password`,
        entityType: 'User',
        entityId: user.id,
        actorId: user.id,
        actorEmail: user.email,
        ...ctx,
      });
    } else {
      // Spend comparable time so the response timing does not reveal the account.
      await this.passwords.verifyDummy(this.config.env.ADMIN_RESET_PASSWORD);
    }
    return FORGOT_MESSAGE;
  }

  async me(userId: string) {
    return this.db.user.findUniqueOrThrow({ where: { id: userId } });
  }
}
