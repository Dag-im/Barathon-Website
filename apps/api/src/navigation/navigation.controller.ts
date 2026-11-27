import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { MenuLocation } from '@prisma/client';
import { Public } from '../common/decorators/access.decorators';
import { parse } from '../common/content/crud.controller';
import { ApiError } from '../common/utils/errors';
import { NavigationService, menuItemSchema, LOCATIONS } from './navigation.service';

const locationParam = (value: string): MenuLocation => {
  if (!LOCATIONS.includes(value as MenuLocation)) throw ApiError.notFound('Menu');
  return value as MenuLocation;
};

@ApiTags('admin-navigation')
@Controller('admin/menus')
export class MenusAdminController {
  constructor(private readonly nav: NavigationService) {}

  @Get()
  all() {
    return this.nav.adminAll();
  }

  @Get(':location')
  one(@Param('location') location: string) {
    return this.nav.adminMenu(locationParam(location));
  }

  @Put(':location/items')
  replace(@Param('location') location: string, @Body() body: unknown) {
    const { items } = parse(z.object({ items: z.array(menuItemSchema).max(50) }).strict(), body);
    return this.nav.replace(locationParam(location), items);
  }
}

@ApiTags('public-menus')
@Controller('public/menus')
export class MenusPublicController {
  constructor(private readonly nav: NavigationService) {}

  @Public()
  @Get()
  async all() {
    const map = await this.nav.publicAll();
    return { data: LOCATIONS.map((location) => ({ location, items: map[location] })) };
  }

  @Public()
  @Get(':location')
  one(@Param('location') location: string) {
    return this.nav.publicMenu(locationParam(location));
  }
}
