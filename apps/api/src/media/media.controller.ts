import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { MediaVisibility, MediaKind } from '@prisma/client';
import { zodPipe } from '../common/pipes/zod.pipe';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { paginationSchema, paged, skipTake } from '../common/utils/pagination';
import { ApiError } from '../common/utils/errors';
import { requestContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService, UploadInput } from './media.service';
import { MediaRefService } from './media.refs';
import { AppConfig, APP_CONFIG } from '../config/config';
import { extensionOf } from './sniff';

const listQuery = paginationSchema
  .extend({
    q: z.string().max(120).optional(),
    kind: z.nativeEnum(MediaKind).optional(),
    folderId: z.string().uuid().optional(),
    visibility: z.nativeEnum(MediaVisibility).optional(),
    unused: z.enum(['true', 'false']).optional(),
    sort: z.enum(['-createdAt', 'createdAt', 'originalName']).default('-createdAt'),
  })
  .strict();

const patchBody = z
  .object({
    alt: z.string().max(300).nullable().optional(),
    caption: z.string().max(500).nullable().optional(),
    title: z.string().max(200).nullable().optional(),
    folderId: z.string().uuid().nullable().optional(),
    focalX: z.number().min(0).max(1).nullable().optional(),
    focalY: z.number().min(0).max(1).nullable().optional(),
  })
  .strict();

const bulkBody = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.enum(['move', 'delete']),
    folderId: z.string().uuid().nullable().optional(),
  })
  .strict();

const folderBody = z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().uuid().nullable().optional() }).strict();

const uploadBody = z
  .object({
    folderId: z.string().uuid().optional(),
    alt: z.string().max(300).optional(),
    title: z.string().max(200).optional(),
    caption: z.string().max(500).optional(),
    intent: z.enum(['IMAGE', 'ICON', 'DOCUMENT', 'VIDEO']).optional(),
    visibility: z.nativeEnum(MediaVisibility).optional(),
  })
  .passthrough();

type Multer = { originalname: string; buffer: Buffer; mimetype: string; size: number };

@ApiTags('admin-media')
@Controller('admin')
export class MediaAdminController {
  constructor(
    private readonly media: MediaService,
    private readonly prisma: PrismaService,
    private readonly refs: MediaRefService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  private async adminDto(row: Parameters<MediaService['toDto']>[0] & { folderId?: string | null; uploadedById?: string | null; processingStatus?: string; createdAt: Date; originalName: string; sha256: string; visibility: MediaVisibility; sizeBytes: bigint }) {
    const dto = await this.media.toDto(row);
    const usage = await this.refs.usageOf(row.id);
    return {
      ...dto,
      originalName: row.originalName,
      sha256: row.sha256,
      visibility: row.visibility,
      folderId: row.folderId ?? null,
      processingStatus: row.processingStatus ?? 'READY',
      createdAt: row.createdAt.toISOString(),
      uploadedBy: row.uploadedById ?? null,
      usageCount: usage.length,
      usage: usage.map((u) => ({ entityType: u.entityType, entityId: u.entityId, field: u.field })),
    };
  }

  @Get('media')
  @ApiOperation({ summary: 'List media' })
  async list(@Query(zodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    const where = {
      ...MediaService.filterPrisma({ kind: q.kind, folderId: q.folderId, visibility: q.visibility, search: q.q }),
      ...(q.unused === 'true' ? { mediaRefs: undefined } : {}),
    };
    const unusedIds = q.unused === 'true' ? await this.unusedIds() : null;
    const finalWhere = unusedIds ? { ...where, id: { in: unusedIds } } : where;
    const [rows, total] = await Promise.all([
      this.db.media.findMany({ where: finalWhere, include: { variants: true }, orderBy: { [q.sort.replace('-', '')]: q.sort.startsWith('-') ? 'desc' : 'asc' }, ...skipTake(q.page, q.pageSize) }),
      this.db.media.count({ where: finalWhere }),
    ]);
    const data = await Promise.all(rows.map((r) => this.adminDto(r)));
    return paged(data, total, q.page, q.pageSize);
  }

  /** Media not referenced anywhere and older than 7 days (backend-plan 5.7). */
  private async unusedIds(): Promise<string[]> {
    const cutoff = new Date(Date.now() - 7 * 86_400_000);
    const used = await this.db.mediaRef.findMany({ select: { mediaId: true }, distinct: ['mediaId'] });
    const usedSet = new Set(used.map((u) => u.mediaId));
    const candidates = await this.db.media.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true } });
    return candidates.map((c) => c.id).filter((id) => !usedSet.has(id));
  }

  @Post('media')
  @UseInterceptors(FilesInterceptor('file', 10, { limits: { fileSize: 200 * 1024 * 1024, files: 10 } }))
  @ApiOperation({ summary: 'Upload one or more files (multipart field "file")' })
  async upload(@UploadedFiles() files: Multer[] | undefined, @Body() body: unknown, @CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!files?.length) throw new BadRequestException('No files were uploaded');
    const meta = zodPipe(uploadBody).transform(body);
    const ctx = { ...requestContext(req), userId: user.id, email: user.email };
    const results: Array<Record<string, unknown>> = [];
    for (const f of files) {
      try {
        const input: UploadInput = {
          buffer: f.buffer,
          originalName: f.originalname,
          intent: meta.intent,
          folderId: meta.folderId ?? null,
          alt: meta.alt ?? null,
          title: meta.title ?? null,
          caption: meta.caption ?? null,
          visibility: meta.visibility,
        };
        const { media, duplicates } = await this.media.upload(input, ctx);
        results.push({ ok: true, file: f.originalname, media: await this.adminDto(media), duplicates });
      } catch (err) {
        const e = err as ApiError;
        results.push({ ok: false, file: f.originalname, error: { statusCode: e.getStatus?.() ?? 500, code: e.code ?? 'INTERNAL', message: e.message } });
      }
    }
    const failed = results.filter((r) => !r.ok).length;
    res.status(failed === 0 ? HttpStatus.CREATED : failed === results.length ? 422 : HttpStatus.MULTI_STATUS);
    return { data: results };
  }

  @Get('media/:id')
  @ApiOperation({ summary: 'Media detail with variants, usage and duplicates' })
  async get(@Param('id') id: string) {
    const row = await this.db.media.findFirst({ where: { id }, include: { variants: true } });
    if (!row) throw ApiError.notFound('Media');
    const duplicates = await this.db.media.findMany({ where: { sha256: row.sha256, NOT: { id } }, select: { id: true }, take: 20 });
    return { ...(await this.adminDto(row)), duplicates: duplicates.map((d) => d.id) };
  }

  @Patch('media/:id')
  @ApiOperation({ summary: 'Update media metadata and focal point' })
  async patch(@Param('id') id: string, @Body(zodPipe(patchBody)) body: z.infer<typeof patchBody>) {
    const existing = await this.db.media.findFirst({ where: { id } });
    if (!existing) throw ApiError.notFound('Media');
    if (body.folderId) {
      const folder = await this.db.mediaFolder.findFirst({ where: { id: body.folderId } });
      if (!folder) throw ApiError.validation([{ field: 'folderId', message: 'Folder does not exist' }]);
    }
    const row = await this.db.media.update({ where: { id }, data: body, include: { variants: true } });
    return this.adminDto(row);
  }

  @Put('media/:id/file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Replace the file of a media item (same kind)' })
  async replaceFile(@Param('id') id: string, @UploadedFile() file: Multer | undefined, @CurrentUser() user: AuthUser, @Req() req: Request) {
    if (!file) throw new BadRequestException('No file was uploaded');
    const row = await this.media.replaceFile(id, { buffer: file.buffer, originalName: file.originalname }, { ...requestContext(req), userId: user.id, email: user.email });
    return this.adminDto(row);
  }

  @Delete('media/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete media (409 MEDIA_IN_USE unless force=true)' })
  async remove(@Param('id') id: string, @Query('force') force: string | undefined, @CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    await this.media.purge(id, force === 'true', { ...requestContext(req), userId: user.id, email: user.email });
  }

  @Post('media/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk move or delete media' })
  async bulk(@Body(zodPipe(bulkBody)) body: z.infer<typeof bulkBody>, @CurrentUser() user: AuthUser, @Req() req: Request) {
    let affected = 0;
    if (body.action === 'move') {
      const r = await this.db.media.updateMany({ where: { id: { in: body.ids } }, data: { folderId: body.folderId ?? null } });
      affected = r.count;
    } else {
      for (const id of body.ids) {
        try {
          await this.media.purge(id, false, { ...requestContext(req), userId: user.id, email: user.email });
          affected += 1;
        } catch {
          // Items in use are skipped; the response reports how many were removed.
        }
      }
    }
    return { affected };
  }

  @Get('media/:id/download')
  @ApiOperation({ summary: 'Stream the original file (admin only)' })
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { row, stream } = await this.media.originalStream(id);
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${row.originalName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    stream.pipe(res);
  }

  @Post('media/:id/regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-run image variant generation' })
  async regenerate(@Param('id') id: string) {
    const row = await this.media.regenerate(id);
    return this.adminDto(row);
  }

  // ---------------------------------------------------------------- folders

  @Get('media-folders')
  @ApiOperation({ summary: 'List media folders' })
  async folders() {
    return { data: await this.db.mediaFolder.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }) };
  }

  @Post('media-folders')
  @ApiOperation({ summary: 'Create a media folder' })
  async createFolder(@Body(zodPipe(folderBody)) body: z.infer<typeof folderBody>) {
    return this.db.mediaFolder.create({ data: { name: body.name, parentId: body.parentId ?? null } });
  }

  @Patch('media-folders/:id')
  @ApiOperation({ summary: 'Rename or move a media folder' })
  async patchFolder(@Param('id') id: string, @Body(zodPipe(folderBody.partial())) body: Partial<z.infer<typeof folderBody>>) {
    return this.db.mediaFolder.update({ where: { id }, data: body });
  }

  @Delete('media-folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an empty media folder' })
  async deleteFolder(@Param('id') id: string): Promise<void> {
    const count = await this.db.media.count({ where: { folderId: id } });
    if (count > 0) throw ApiError.conflict('CONFLICT', 'Folder is not empty');
    await this.db.mediaFolder.delete({ where: { id } });
  }
}

export { extensionOf };
