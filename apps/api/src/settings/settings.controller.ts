import { Body, Controller, Get, Param, Patch, Put, Query, Req, Res, Post, HttpCode, HttpStatus, Delete, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/access.decorators';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { parse, crudContext } from '../common/content/crud.controller';
import { SettingsService, UiStringService } from './settings.service';
import { GROUP_NAMES, GroupName } from './settings.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/utils/errors';
import { paged, skipTake } from '../common/utils/pagination';
import { UI_STRING_DEFAULTS } from './defaults';
import { RevalidationService } from '../revalidation/revalidation.service';

const uiStringsBody = z.object({ items: z.array(z.object({ key: z.string().min(1).max(120), value: z.string().max(2000), locale: z.string().max(5).optional() }).strict()).min(1).max(200) }).strict();
const KEY_PATTERN = /^[a-z0-9]+(\.[a-zA-Z0-9]+)+$/;

@ApiTags('admin-settings')
@Controller('admin/settings')
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.adminDto();
  }

  @Put()
  replaceAll(@Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const b = (body ?? {}) as Record<string, unknown> & { expectedVersion?: number };
    const { expectedVersion, ...groups } = b;
    for (const key of Object.keys(groups)) {
      if (!GROUP_NAMES.includes(key as GroupName)) throw ApiError.validation([{ field: key, message: 'Unknown settings group' }]);
    }
    return this.settings.update(groups, expectedVersion, crudContext(req, user));
  }

  @Get('revisions')
  revisions() {
    return this.settings.revisions();
  }

  @Patch(':group')
  patch(@Param('group') group: string, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request) {
    if (!GROUP_NAMES.includes(group as GroupName)) throw ApiError.notFound('Settings group');
    const b = (body ?? {}) as Record<string, unknown> & { expectedVersion?: number };
    const { expectedVersion, ...payload } = b;
    return this.settings.update({ [group]: payload }, expectedVersion, crudContext(req, user), group as GroupName);
  }
}

@ApiTags('admin-ui-strings')
@Controller('admin/ui-strings')
export class UiStringsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('group') group?: string, @Query('q') q?: string) {
    const defaults = UI_STRING_DEFAULTS.filter((d) => (!group || d.group === group) && (!q || d.key.includes(q) || d.value.toLowerCase().includes(q.toLowerCase())));
    const overrides = await this.prisma.client.uiString.findMany({ where: { locale: 'en' } });
    const byKey = new Map(overrides.map((o) => [o.key, o]));
    const data = defaults.map((d) => ({ key: d.key, group: d.group, value: byKey.get(d.key)?.value ?? d.value, overridden: byKey.has(d.key), defaultValue: d.value, locale: 'en' }));
    return { data };
  }

  @Put()
  async bulk(@Body() body: unknown) {
    const { items } = parse(uiStringsBody, body);
    const known = new Map(UI_STRING_DEFAULTS.map((d) => [d.key, d.group]));
    for (const item of items) {
      if (!known.has(item.key) && !KEY_PATTERN.test(item.key)) throw ApiError.validation([{ field: item.key, message: 'Key must look like group.name' }]);
    }
    await this.prisma.client.$transaction(
      items.map((item) => {
        const locale = item.locale ?? 'en';
        const group = known.get(item.key) ?? item.key.split('.')[0];
        return this.prisma.client.uiString.upsert({
          where: { key_locale: { key: item.key, locale } },
          create: { key: item.key, locale, value: item.value, group },
          update: { value: item.value },
        });
      }),
    );
    return { updated: items.length };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revert(@Param('id') id: string): Promise<void> {
    const row = await this.prisma.client.uiString.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('UI string');
    await this.prisma.client.uiString.delete({ where: { id } });
  }
}

@ApiTags('public-settings')
@Controller('public')
export class SettingsPublicController {
  constructor(
    private readonly ui: UiStringService,
    @Inject(RevalidationService) private readonly reval: RevalidationService,
  ) {
    void reval;
  }

  @Public()
  @Get('ui-strings')
  async uiStrings(@Query('locale') locale = 'en', @Query('group') group?: string) {
    if (locale !== 'en') throw new ApiError(400, 'UNSUPPORTED_LOCALE', 'Only the English locale is available');
    return { data: await this.ui.merged(group, locale) };
  }
}

export { paged, skipTake, Res, Post };
