import { BadRequestException, Body, Controller, Get, Headers, Injectable, Inject, Param, Post, Query, Req, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { VideoSourceType } from '@prisma/client';
import { Public } from '../common/decorators/access.decorators';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CrudAdminController, parse, crudContext } from '../common/content/crud.controller';
import { PublishableCrud, CrudContext } from '../common/content/content-crud';
import { assertLive, assertMedia } from '../common/content/refs';
import { plainText } from '../common/utils/sanitize';
import { ApiError } from '../common/utils/errors';
import { TagSet } from '../common/constants/revalidation-map';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { SeoService } from '../seo/seo.service';
import { MediaRefService } from '../media/media.refs';
import { RedirectsService } from '../redirects/redirects.service';
import { MediaService } from '../media/media.service';
import { StorageService } from '../storage/storage.service';
import { VideosReadService } from './videos.read';
import { requireYouTube } from './youtube';
import { AppConfig, APP_CONFIG } from '../config/config';

const id = z.string().uuid();
export const videoYoutubeInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(600).nullable().optional(),
    sourceType: z.literal('YOUTUBE').optional(),
    url: z.string().min(1).max(500),
    startSeconds: z.number().int().min(0).nullable().optional(),
    posterMediaId: id.nullable().optional(),
    brandId: id.nullable().optional(),
    productId: id.nullable().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();
export const videoUpdate = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(600).nullable().optional(),
    url: z.string().min(1).max(500).optional(),
    startSeconds: z.number().int().min(0).nullable().optional(),
    posterMediaId: id.nullable().optional(),
    brandId: id.nullable().optional(),
    productId: id.nullable().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    expectedVersion: z.number().int().optional(),
  })
  .strict();
export const videoUploadFields = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(600).optional(),
    brandId: id.optional(),
    productId: id.optional(),
    isFeatured: z.enum(['true', 'false']).optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .strict();

@Injectable()
export class VideosService extends PublishableCrud<any> {
  protected readonly delegate = 'video';
  protected readonly entityName = 'video';
  protected readonly hasSlug = false;
  protected readonly searchFields = ['title'];

  constructor(
    prisma: PrismaService,
    audit: AuditService,
    revalidation: RevalidationService,
    seo: SeoService,
    refs: MediaRefService,
    redirects: RedirectsService,
    private readonly media: MediaService,
    private readonly reads: VideosReadService,
    private readonly storage: StorageService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    super(prisma, audit, revalidation, seo, refs, redirects);
  }

  protected include() {
    return { brand: { select: { id: true, name: true, slug: true } }, product: { select: { id: true, title: true, slug: true } } };
  }

  protected tags(_row: any): TagSet {
    return { tags: ['videos', 'page:home', 'brands', 'products', 'sitemap'], paths: [] };
  }

  protected async mediaIndex(row: any) {
    return { refs: [{ field: 'posterMediaId', mediaId: row.posterMediaId }, { field: 'mediaId', mediaId: row.mediaId }], html: [] };
  }

  protected async prepare(input: Record<string, unknown>, existing: any) {
    const i = input as any;
    await assertMedia(this.prisma, [i.posterMediaId], ['IMAGE', 'SVG'], 'posterMediaId');
    await assertLive(this.prisma, 'brand', i.brandId, 'brandId');
    await assertLive(this.prisma, 'product', i.productId, 'productId');
    const data: Record<string, unknown> = {};
    for (const k of ['posterMediaId', 'brandId', 'productId', 'isFeatured', 'sortOrder', 'startSeconds', 'mediaId', 'mimeType', 'sizeBytes', 'durationSeconds']) {
      if (i[k] !== undefined) data[k] = i[k];
    }
    if (i.title !== undefined) data.title = plainText(i.title);
    if (i.description !== undefined) data.description = i.description ? plainText(i.description) : null;

    if (i.url !== undefined) {
      if (existing?.sourceType === VideoSourceType.UPLOAD) {
        throw ApiError.validation([{ field: 'url', message: 'Uploaded videos cannot be switched to a YouTube link; upload a new file' }]);
      }
      const parsed = requireYouTube(i.url);
      Object.assign(data, { sourceType: VideoSourceType.YOUTUBE, youtubeId: parsed.youtubeId, sourceUrl: parsed.sourceUrl, startSeconds: i.startSeconds ?? parsed.startSeconds });
    } else if (!existing && i.mediaId === undefined) {
      throw ApiError.validation([{ field: 'url', message: 'A YouTube link or an uploaded file is required' }]);
    }
    return data;
  }

  protected async validatePublish(row: any): Promise<void> {
    if (row.sourceType === 'YOUTUBE' && !row.youtubeId) throw ApiError.validation([{ field: 'url', message: 'Video has no YouTube id' }]);
    if (row.sourceType === 'UPLOAD' && !row.mediaId) throw ApiError.validation([{ field: 'file', message: 'Video has no uploaded file' }]);
  }

  protected async dto(row: any) {
    const media = await this.media.resolveMany([row.posterMediaId, row.mediaId]);
    const base = this.reads.dto({ ...row, sizeBytes: row.sizeBytes }, media);
    return {
      ...base,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      sortOrder: row.sortOrder,
      version: row.version,
      brandId: row.brandId,
      productId: row.productId,
      posterMediaId: row.posterMediaId,
      mediaId: row.mediaId,
      sourceUrl: row.sourceUrl ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      warnings: [
        ...(row.sourceType === 'YOUTUBE' && !row.posterMediaId ? [{ code: 'DEFAULT_POSTER', message: 'Using the YouTube thumbnail as poster' }] : []),
        ...(row.sourceType === 'UPLOAD' && !row.posterMediaId ? [{ code: 'MISSING_POSTER', message: 'Upload a poster image for this video' }] : []),
      ],
    };
  }

  /** Creates an uploaded video: stores the file, optional poster, then the row. */
  async createUpload(fields: z.infer<typeof videoUploadFields>, file: { buffer: Buffer; originalname: string }, poster: { buffer: Buffer; originalname: string } | undefined, ctx: CrudContext) {
    const rctx = { ...ctx };
    const uploaded = await this.media.upload({ buffer: file.buffer, originalName: file.originalname, intent: 'VIDEO', visibility: 'PUBLIC' }, { ...rctx, userId: ctx.userId, email: ctx.email });
    let posterId: string | null = null;
    try {
      const posterBuffer = poster?.buffer ?? (await this.media.generatePoster(file.buffer));
      if (posterBuffer) {
        const p = await this.media.uploadPoster({ buffer: posterBuffer, originalName: poster?.originalname ?? 'poster.jpg' }, { ...rctx, userId: ctx.userId });
        posterId = p.id;
      }
    } catch (err) {
      // A missing poster never blocks the upload; the admin is warned in the DTO.
      void err;
    }
    return this.create(
      {
        title: fields.title,
        description: fields.description ?? null,
        brandId: fields.brandId ?? null,
        productId: fields.productId ?? null,
        isFeatured: fields.isFeatured === 'true',
        sortOrder: fields.sortOrder ?? 0,
        posterMediaId: posterId,
        sourceType: VideoSourceType.UPLOAD,
        mediaId: uploaded.media.id,
        mimeType: uploaded.media.mimeType,
        sizeBytes: uploaded.media.sizeBytes,
      },
      ctx,
    );
  }

  /** Serves an uploaded video with Range support (206 partial content). */
  async stream(videoId: string, range: string | undefined, res: Response): Promise<void> {
    const target = await this.reads.uploadedMediaKey(videoId);
    if (!target) throw ApiError.notFound('Video');
    const stat = await this.storage.raw.stat(target.bucket, target.key);
    if (!stat) throw ApiError.notFound('Video');
    const total = stat.size;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', target.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    let start = 0;
    let end = total - 1;
    const m = range?.match(/^bytes=(\d*)-(\d*)$/);
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') {
        const suffix = Number(m[2]);
        start = Math.max(0, total - suffix);
      } else {
        start = Number(m[1]);
        end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
      }
      if (start > end || start >= total) {
        res.setHeader('Content-Range', `bytes */${total}`);
        res.status(416).end();
        return;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}`);
    }
    res.setHeader('Content-Length', String(end - start + 1));
    const stream = await this.storage.raw.read(target.bucket, target.key, start, end);
    stream.pipe(res);
  }
}

@ApiTags('admin-videos')
@Controller('admin/videos')
export class VideosAdminController extends CrudAdminController {
  protected readonly createSchema = videoYoutubeInput;
  protected readonly updateSchema = videoUpdate;
  constructor(readonly crud: VideosService) {
    super();
  }

  @Post('upload')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }, { name: 'poster', maxCount: 1 }], { limits: { fileSize: 200 * 1024 * 1024 } }))
  async upload(
    @UploadedFiles() files: { file?: Array<{ buffer: Buffer; originalname: string }>; poster?: Array<{ buffer: Buffer; originalname: string }> },
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const file = files?.file?.[0];
    if (!file) throw new BadRequestException('A video file is required (field "file")');
    const fields = parse(videoUploadFields, body);
    return this.crud.createUpload(fields, file, files.poster?.[0], crudContext(req, user));
  }
}

@ApiTags('public-videos')
@Controller('public/videos')
export class VideosPublicController {
  constructor(
    private readonly reads: VideosReadService,
    private readonly videos: VideosService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: Record<string, string>) {
    const q = parse(
      z
        .object({
          featured: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
          brand: z.string().max(96).optional(),
          product: z.string().max(96).optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(48).default(24),
        })
        .strict(),
      query,
    );
    return this.reads.listPublic(q);
  }

  @Public()
  @Get(':id/stream')
  stream(@Param('id') id: string, @Headers('range') range: string | undefined, @Res() res: Response) {
    return this.videos.stream(id, range, res);
  }

  @Public()
  @Get(':id')
  async detail(@Param('id') id: string) {
    const v = await this.reads.getPublic(id);
    if (!v) throw ApiError.notFound('Video');
    return v;
  }
}

