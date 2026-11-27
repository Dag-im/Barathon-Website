import type { CookieOptions, Response } from 'express';
import { AppConfig } from '../config/config';

export interface AuthCookieValues {
  accessToken: string;
  refreshValue: string;
  csrfToken: string;
}

/** Sets or clears the three auth cookies (backend-plan 4.2). */
export class AuthCookies {
  constructor(private readonly config: AppConfig) {}

  private base(): CookieOptions {
    return { secure: this.config.env.COOKIE_SECURE, sameSite: 'lax', httpOnly: true };
  }

  set(res: Response, values: AuthCookieValues): void {
    const names = this.config.cookieNames;
    const paths = this.config.cookiePaths;
    res.cookie(names.access, values.accessToken, {
      ...this.base(),
      path: paths.access,
      maxAge: this.config.accessTtlSeconds * 1000,
    });
    res.cookie(names.refresh, values.refreshValue, {
      ...this.base(),
      sameSite: 'strict',
      path: paths.refresh,
      maxAge: this.config.refreshIdleMs,
    });
    res.cookie(names.csrf, values.csrfToken, {
      secure: this.config.env.COOKIE_SECURE,
      sameSite: 'lax',
      httpOnly: false,
      path: paths.csrf,
      maxAge: this.config.sessionAbsoluteMs,
    });
  }

  clear(res: Response): void {
    const names = this.config.cookieNames;
    const paths = this.config.cookiePaths;
    const common = { secure: this.config.env.COOKIE_SECURE, path: paths.access };
    res.clearCookie(names.access, { ...common, httpOnly: true, sameSite: 'lax' });
    res.clearCookie(names.refresh, { secure: this.config.env.COOKIE_SECURE, path: paths.refresh, httpOnly: true, sameSite: 'strict' });
    res.clearCookie(names.csrf, { ...common, httpOnly: false, sameSite: 'lax' });
  }
}
