import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/decorators/access.decorators';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CrudAdminController, parse, crudContext, reorderSchema } from '../common/content/crud.controller';
import { ApiError } from '../common/utils/errors';
import { PagesService, pageInput, pageUpdate, blockBody } from './pages.service';

@ApiTags('admin-pages')
@Controller('admin/pages')
export class PagesAdminController extends CrudAdminController {
  protected readonly createSchema = pageInput;
  protected readonly updateSchema = pageUpdate;
  constructor(readonly crud: PagesService) {
    super();
  }

  @Get('by-key/:key')
  async byKey(@Param('key') key: string) {
    return this.crud.findByKey(key);
  }

  @Get(':id/blocks')
  blocks(@Param('id') id: string) {
    return this.crud.listBlocks(id);
  }

  @Post(':id/blocks')
  async addBlock(@Param('id') id: string, @Body() body: unknown) {
    return this.crud.addBlock(id, parse(blockBody, body));
  }

  @Put(':id/blocks')
  async replaceBlocks(@Param('id') id: string, @Body() body: unknown) {
    const { blocks } = parse(z.object({ blocks: z.array(blockBody).max(60) }).strict(), body);
    await this.crud.findOrFail(id);
    await this.crud.replaceBlocks(id, blocks);
    return this.crud.listBlocks(id);
  }

  @Patch(':id/blocks/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderBlocks(@Param('id') id: string, @Body() body: unknown): Promise<void> {
    await this.crud.reorderBlocks(id, parse(reorderSchema, body).ids);
  }

  @Patch(':id/blocks/:blockId')
  async patchBlock(@Param('id') id: string, @Param('blockId') blockId: string, @Body() body: unknown) {
    return this.crud.updateBlock(id, blockId, parse(blockBody.partial(), body));
  }

  @Delete(':id/blocks/:blockId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlock(@Param('id') id: string, @Param('blockId') blockId: string): Promise<void> {
    await this.crud.deleteBlock(id, blockId);
  }

  @Post(':id/blocks/:blockId/duplicate')
  duplicateBlock(@Param('id') id: string, @Param('blockId') blockId: string) {
    return this.crud.duplicateBlock(id, blockId);
  }
}

@ApiTags('admin-block-types')
@Controller('admin/block-types')
export class BlockTypesController {
  @Get()
  list() {
    return PagesService.blockTypes();
  }
}

@ApiTags('public-pages')
@Controller('public/pages')
export class PagesPublicController {
  constructor(private readonly pages: PagesService) {}

  @Public()
  @Get()
  list() {
    return this.pages.publicList();
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    if (!/^[a-z0-9-]{1,96}$/i.test(slug)) throw ApiError.notFound('Page');
    return this.pages.publicPage(slug);
  }
}

