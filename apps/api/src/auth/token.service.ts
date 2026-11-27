import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomToken, sha256Hex } from '../common/utils/crypto';
import { AppConfig, APP_CONFIG } from '../config/config';

export const JWT_ISSUER = 'barathon-api';
export const JWT_AUDIENCE = 'barathon-admin';

export interface AccessClaims {
  sub: string;
  sid: string;
  role: 'ADMIN';
  tv: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  signAccess(claims: AccessClaims): string {
    return this.jwt.sign(claims, {
      secret: this.config.env.JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: this.config.accessTtlSeconds,
      jwtid: randomToken(12),
    });
  }

  /** Opaque refresh token: "<sessionId>.<secret>"; only sha256(secret) is stored. */
  newRefreshSecret(): { secret: string; hash: string } {
    const secret = randomToken(32);
    return { secret, hash: sha256Hex(secret) };
  }

  hash(secret: string): string {
    return sha256Hex(secret);
  }

  formatRefresh(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  parseRefresh(value: string): { sessionId: string; secret: string } | null {
    const dot = value.indexOf('.');
    if (dot <= 0 || dot === value.length - 1) return null;
    return { sessionId: value.slice(0, dot), secret: value.slice(dot + 1) };
  }
}
