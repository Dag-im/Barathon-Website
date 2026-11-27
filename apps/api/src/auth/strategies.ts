import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import { Strategy as CustomStrategy } from 'passport-custom';
import type { Request } from 'express';
import { AppConfig, APP_CONFIG } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { JWT_AUDIENCE, JWT_ISSUER, AccessClaims } from './token.service';
import { AuthService, ValidatedRefresh } from './auth.service';
import { requestContext } from './auth.types';

/** Access token strategy: cookie first, bearer only when ALLOW_BEARER is enabled. */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(JwtStrategyBase, 'jwt') {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        const fromCookie = req?.cookies?.[config.cookieNames.access];
        if (typeof fromCookie === 'string' && fromCookie) return fromCookie;
        return config.env.ALLOW_BEARER ? ExtractJwt.fromAuthHeaderAsBearerToken()(req) : null;
      },
      secretOrKey: config.env.JWT_ACCESS_SECRET,
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessClaims): Promise<AuthUser> {
    const db = this.prisma.client;
    const session = await db.authSession.findFirst({ where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw new UnauthorizedException();
    }
    if (session.idleExpiresAt.getTime() <= Date.now() || session.absoluteExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'ADMIN',
      sessionId: session.id,
      mustChangePassword: user.mustChangePassword,
    };
  }
}

/** Refresh strategy: reads the HttpOnly refresh cookie and applies rotation rules. */
@Injectable()
export class RefreshStrategy extends PassportStrategy(CustomStrategy, 'refresh-token') {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly auth: AuthService,
  ) {
    super();
  }

  async validate(req: Request & { id?: string }): Promise<ValidatedRefresh> {
    const value = req.cookies?.[this.config.cookieNames.refresh] as string | undefined;
    return this.auth.validateRefresh(value, requestContext(req));
  }
}
