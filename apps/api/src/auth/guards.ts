import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiError } from '../common/utils/errors';
import { ALLOW_PASSWORD_CHANGE, IS_PUBLIC, SKIP_CSRF } from '../common/decorators/access.decorators';
import { safeEqual } from '../common/utils/crypto';
import { AppConfig, APP_CONFIG } from '../config/config';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: unknown, user: T, info: { name?: string } | undefined): T {
    if (err) throw err;
    if (!user) {
      if (info?.name === 'TokenExpiredError') throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token expired');
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    return user;
  }
}

/** Refresh cookie guard for POST /auth/refresh. */
@Injectable()
export class RefreshAuthGuard extends AuthGuard('refresh-token') {
  handleRequest<T>(err: unknown, user: T): T {
    if (err) throw err;
    if (!user) throw new UnauthorizedException();
    return user;
  }
}

/**
 * Applies to every route after authentication: origin check and double-submit CSRF on unsafe
 * methods, and the forced password change gate (backend-plan 4.6, amendment A2).
 */
@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: { mustChangePassword: boolean } }>();
    const path = req.path ?? req.url;
    const handler = context.getHandler();
    const cls = context.getClass();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, cls]);
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [handler, cls]);
    const allowDuringChange = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE, [handler, cls]);

    const guarded = path.startsWith('/api/v1/admin') || path.startsWith('/api/v1/auth');
    if (UNSAFE.has(req.method) && guarded) {
      this.checkOrigin(req);
      if (!skipCsrf) this.checkCsrf(req);
    }

    if (!isPublic && req.user?.mustChangePassword && path.startsWith('/api/v1/admin') && !allowDuringChange) {
      throw new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must choose a new password before continuing');
    }
    return true;
  }

  private checkOrigin(req: Request): void {
    const origin = req.headers.origin ?? req.headers.referer;
    if (!origin) throw new ApiError(403, 'ORIGIN_REQUIRED', 'Origin header is required');
    let host: string;
    try {
      host = new URL(origin).origin;
    } catch {
      throw new ApiError(403, 'FORBIDDEN', 'Origin is not allowed');
    }
    if (!this.config.env.ALLOWED_ORIGINS.includes(host)) {
      throw new ApiError(403, 'FORBIDDEN', 'Origin is not allowed');
    }
  }

  private checkCsrf(req: Request): void {
    const cookie = req.cookies?.[this.config.cookieNames.csrf] as string | undefined;
    const header = req.headers['x-csrf-token'];
    if (typeof header !== 'string' || !cookie || !safeEqual(header, cookie)) {
      throw new ApiError(403, 'CSRF_INVALID', 'CSRF token missing or invalid');
    }
  }
}
