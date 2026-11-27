import { Body, Controller, Get, HttpCode, HttpStatus, Delete, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppConfig, APP_CONFIG } from '../config/config';
import { Inject } from '@nestjs/common';
import { AllowPasswordChange, Public, SkipCsrf } from '../common/decorators/access.decorators';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { zodPipe } from '../common/pipes/zod.pipe';
import { AuthService } from './auth.service';
import { AuthCookies } from './cookies';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, revokeSessionParams, ChangePasswordDto, ForgotPasswordDto, LoginDto } from './auth.dto';
import { RefreshAuthGuard } from './guards';
import { requestContext } from './auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/utils/errors';
import { User } from '@prisma/client';

export function meDto(user: User, csrfToken: string) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: 'ADMIN' as const,
    avatar: null,
    mustChangePassword: user.mustChangePassword,
    twoFactorEnabled: false,
    csrfToken,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookies: AuthCookies;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.cookies = new AuthCookies(config);
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(@Body(zodPipe(loginSchema)) body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, issued } = await this.auth.login(body, requestContext(req));
    this.cookies.set(res, { accessToken: issued.accessToken, refreshValue: issued.refreshValue, csrfToken: issued.csrfToken });
    return { status: 'OK', user: meDto(user, issued.csrfToken), mustChangePassword: user.mustChangePassword, csrfToken: issued.csrfToken };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the refresh token and issue new cookies' })
  async refresh(@Req() req: Request & { user: Awaited<ReturnType<AuthService['validateRefresh']>> }, @Res({ passthrough: true }) res: Response) {
    const issued = await this.auth.rotate(req.user);
    this.cookies.set(res, { accessToken: issued.accessToken, refreshValue: issued.refreshValue, csrfToken: issued.csrfToken });
    return { user: meDto(req.user.user, issued.csrfToken), csrfToken: issued.csrfToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowPasswordChange()
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(user.sessionId, { ...requestContext(req), userId: user.id, email: user.email });
    this.cookies.clear(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowPasswordChange()
  @ApiOperation({ summary: 'Revoke every session of the account' })
  async logoutAll(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logoutAll(user.id, user.email, requestContext(req));
    this.cookies.clear(res);
  }

  @Get('me')
  @AllowPasswordChange()
  @ApiOperation({ summary: 'Current account profile' })
  async me(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const row = await this.auth.me(user.id);
    return meDto(row, req.cookies?.[this.config.cookieNames.csrf] ?? '');
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions' })
  async sessions(@CurrentUser() user: AuthUser) {
    return { data: await this.auth.listSessions(user.id, user.sessionId) };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one of the caller sessions' })
  async revokeSession(@Param() params: unknown, @CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const { id } = zodPipe(revokeSessionParams).transform(params);
    const wasCurrent = await this.auth.revokeOwnSession(user.id, id, user.sessionId, requestContext(req), user.email);
    if (wasCurrent) this.cookies.clear(res);
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset the admin password to the configured default (generic response)' })
  async forgot(@Body(zodPipe(forgotPasswordSchema)) body: ForgotPasswordDto, @Req() req: Request) {
    const message = await this.auth.forgotPassword(body.identifier, requestContext(req));
    return { message };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowPasswordChange()
  @ApiOperation({ summary: 'Change password (required first step after a reset)' })
  async changePassword(
    @Body(zodPipe(changePasswordSchema)) body: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const row = await this.prisma.client.user.findUnique({ where: { id: user.id } });
    if (!row) throw ApiError.notFound('Account');
    const issued = await this.auth.changePassword(row, user.sessionId, body, requestContext(req));
    this.cookies.set(res, { accessToken: issued.accessToken, refreshValue: issued.refreshValue, csrfToken: issued.csrfToken });
  }

}

