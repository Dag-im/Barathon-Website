import { Inject, Injectable, Logger } from '@nestjs/common';
import { MediaKind, MediaVisibility, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { createHash } from 'crypto';
import { ApiError } from '../common/utils/errors';
import { slugify } from '../common/utils/slug';
import { AppConfig, APP_CONFIG } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { extensionOf, sniff, Sniffed } from './sniff';
import { imageSize, InvalidImageError, processImage } from './image.processor';
import { pdfHasActiveContent, sanitizeSvg } from './svg';
import { MediaDto, MediaRow, toMediaDto } from './media.dto';
import { MediaRefService } from './media.refs';
import { RequestContext } from '../auth/auth.types';
import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export type IntentInput = 'IMAGE' | 'ICON' | 'DOCUMENT' | 'VIDEO' | undefined;

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  intent?: IntentInput;
  folderId?: string | null;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
  visibility?: MediaVisibility;
}

export interface UploadResult {
  media: MediaRow;
  sha256: string;
  duplicates: string[];
}

interface StoredObject {
  bucket: string;
  key: string;
  data: Buffer;
  contentType: string;
}

interface Prepared {
  id: string;
  version: number;
  kind: MediaKind;
  mime: string;
  visibility: MediaVisibility;
  bucket: string;
  objectKey: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  dominantColor: string | null;
  lqip: string | null;
  objects: StoredObject[];
  variants: Array<{ label: string; format: string; width: number; height: number; objectKey: string; sizeBytes: number }>;
}

const MB = 1024 * 1024;

export const PUBLIC_ASSET_KINDS = new Set<MediaKind>([MediaKind.IMAGE, MediaKind.SVG, MediaKind.ICON, MediaKind.VIDEO]);

@Injectable()
export class MediaService {
  private readonly logger = new Logger('Media');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly refs: MediaRefService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  get maxUploadBytes(): number {
    return Math.max(this.config.env.MAX_VIDEO_UPLOAD_MB, this.config.env.MAX_DOCUMENT_UPLOAD_MB) * MB;
  }

  private limitFor(kind: MediaKind): number {
    const env = this.config.env;
    switch (kind) {
      case MediaKind.VIDEO:
        return env.MAX_VIDEO_UPLOAD_MB * MB;
      case MediaKind.DOCUMENT:
        return env.MAX_DOCUMENT_UPLOAD_MB * MB;
      case MediaKind.SVG:
        return 1 * MB;
      case MediaKind.ICON:
        return 256 * 1024;
      default:
        return env.MAX_IMAGE_UPLOAD_MB * MB;
    }
  }

  /** Validates magic bytes, extension, size and intent, then produces the storage plan. */
  private async prepare(input: UploadInput, opts: { id: string; version: number; date: Date }): Promise<Prepared> {
    const sniffed: Sniffed | null = sniff(input.buffer);
    if (!sniffed) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'File type is not supported');

    const ext = extensionOf(input.originalName);
    if (ext && !sniffed.extensions.includes(ext)) {
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'File extension does not match its content');
    }

    let kind = sniffed.kind;
    if (input.intent === 'ICON') {
      if (!['image/x-icon', 'image/png'].includes(sniffed.mime)) {
        throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Icons must be ICO or PNG');
      }
      kind = MediaKind.ICON;
    } else if (input.intent === 'DOCUMENT' && kind !== MediaKind.DOCUMENT) {
      throw ApiError.validation([{ field: 'file', message: 'Expected a PDF document' }]);
    } else if (input.intent === 'VIDEO' && kind !== MediaKind.VIDEO) {
      throw ApiError.validation([{ field: 'file', message: 'Expected a video file' }]);
    } else if (input.intent === 'IMAGE' && kind !== MediaKind.IMAGE && kind !== MediaKind.SVG) {
      throw ApiError.validation([{ field: 'file', message: 'Expected an image' }]);
    }

    const limit = this.limitFor(kind);
    if (input.buffer.length > limit) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `File is larger than the ${Math.round(limit / MB)} MB limit for this type`);
    }

    const yyyy = String(opts.date.getUTCFullYear());
    const mm = String(opts.date.getUTCMonth() + 1).padStart(2, '0');
    const base = `media/${yyyy}/${mm}/${opts.id}/v${opts.version}`;
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const visibility = input.visibility ?? MediaVisibility.PUBLIC;
    const common = { id: opts.id, version: opts.version, visibility, originalName: input.originalName, sha256, sizeBytes: input.buffer.length, kind, mime: sniffed.mime };

    if (kind === MediaKind.SVG) {
      const clean = sanitizeSvg(input.buffer.toString('utf8'));
      if (!clean.svg) throw new InvalidImageError('The SVG could not be read');
      const data = Buffer.from(clean.svg, 'utf8');
      const key = `${base}/original.svg`;
      return {
        ...common,
        sizeBytes: data.length,
        bucket: this.storage.bucketPublic,
        objectKey: key,
        width: clean.width,
        height: clean.height,
        blurhash: null,
        dominantColor: null,
        lqip: null,
        objects: [{ bucket: this.storage.bucketPublic, key, data, contentType: 'image/svg+xml' }],
        variants: [],
      };
    }

    if (kind === MediaKind.DOCUMENT) {
      if (pdfHasActiveContent(input.buffer)) {
        throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'PDF contains active content and was rejected');
      }
      const slug = slugify(input.originalName.replace(/\.pdf$/i, '')) || 'document';
      const isPublic = visibility === MediaVisibility.PUBLIC;
      const bucket = isPublic ? this.storage.bucketPublic : this.storage.bucketPrivate;
      const key = isPublic ? `${base}/${slug}.pdf` : `docs/${yyyy}/${mm}/${opts.id}/v${opts.version}/${slug}.pdf`;
      return {
        ...common,
        bucket,
        objectKey: key,
        width: null,
        height: null,
        blurhash: null,
        dominantColor: null,
        lqip: null,
        objects: [{ bucket, key, data: input.buffer, contentType: 'application/pdf' }],
        variants: [],
      };
    }

    if (kind === MediaKind.VIDEO) {
      const ext2 = sniffed.mime === 'video/webm' ? 'webm' : 'mp4';
      const key = `${base}/original.${ext2}`;
      const dims = await this.probeVideo(input.buffer);
      return {
        ...common,
        bucket: this.storage.bucketPublic,
        objectKey: key,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        blurhash: null,
        dominantColor: null,
        lqip: null,
        objects: [{ bucket: this.storage.bucketPublic, key, data: input.buffer, contentType: sniffed.mime }],
        variants: [],
      };
    }

    // Raster images and icons
    let analysis;
    try {
      analysis = await processImage(input.buffer, sniffed.mime);
    } catch (err) {
      if (err instanceof InvalidImageError) throw new ApiError(422, 'VALIDATION_FAILED', err.message);
      throw err;
    }
    const origExt = analysis.originalFormat === 'jpeg' ? 'jpg' : analysis.originalFormat;
    const originalKey = `${base}/original.${origExt}`;
    const objects: StoredObject[] = [
      {
        bucket: this.storage.bucketPublic,
        key: originalKey,
        data: analysis.original,
        contentType: `image/${analysis.originalFormat === 'jpeg' ? 'jpeg' : analysis.originalFormat}`,
      },
    ];
    const variants: Prepared['variants'] = [];
    for (const v of analysis.variants) {
      const key = `${base}/${v.label}.${v.format}`;
      objects.push({ bucket: this.storage.bucketPublic, key, data: v.data, contentType: `image/${v.format}` });
      variants.push({ label: v.label, format: v.format, width: v.width, height: v.height, objectKey: key, sizeBytes: v.data.length });
    }
    return {
      ...common,
      kind: kind === MediaKind.ICON ? MediaKind.ICON : MediaKind.IMAGE,
      sizeBytes: analysis.original.length,
      sha256: createHash('sha256').update(analysis.original).digest('hex'),
      bucket: this.storage.bucketPublic,
      objectKey: originalKey,
      width: analysis.width,
      height: analysis.height,
      blurhash: analysis.blurhash,
      dominantColor: analysis.dominantColor,
      lqip: analysis.lqip,
      objects,
      variants,
    };
  }

  /** Optional duration/size probe with ffprobe; returns null when unavailable. */
  private async probeVideo(buffer: Buffer): Promise<{ width: number; height: number; duration: number } | null> {
    const ffprobe = this.config.env.FFMPEG_PATH ? this.config.env.FFMPEG_PATH.replace(/ffmpeg$/, 'ffprobe') : 'ffprobe';
    const dir = await mkdtemp(join(tmpdir(), 'bt-probe-'));
    try {
      const file = join(dir, 'in.bin');
      await writeFile(file, buffer);
      const out = await new Promise<string>((resolve, reject) =>
        execFile(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { timeout: 15000 }, (err, stdout) =>
          err ? reject(err) : resolve(stdout),
        ),
      );
      const json = JSON.parse(out) as { streams?: Array<{ codec_type?: string; width?: number; height?: number }>; format?: { duration?: string } };
      const v = json.streams?.find((s) => s.codec_type === 'video');
      return { width: v?.width ?? 0, height: v?.height ?? 0, duration: Math.round(Number(json.format?.duration ?? 0)) };
    } catch {
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /** Extracts a poster frame at one second with ffmpeg when it is configured. */
  async generatePoster(buffer: Buffer): Promise<Buffer | null> {
    if (!this.config.env.FFMPEG_PATH) return null;
    const dir = await mkdtemp(join(tmpdir(), 'bt-poster-'));
    try {
      const input = join(dir, 'in.bin');
      const output = join(dir, 'poster.jpg');
      await writeFile(input, buffer);
      await new Promise<void>((resolve, reject) =>
        execFile(this.config.env.FFMPEG_PATH, ['-y', '-ss', '1', '-i', input, '-frames:v', '1', output], { timeout: 30000 }, (err) =>
          err ? reject(err) : resolve(),
        ),
      );
      return await readFile(output);
    } catch {
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private async writeObjects(objects: StoredObject[]): Promise<void> {
    const written: StoredObject[] = [];
    try {
      for (const o of objects) {
        await this.storage.raw.put(o.bucket, o.key, o.data, o.contentType);
        written.push(o);
      }
    } catch (err) {
      await this.removeObjects(written);
      this.logger.error({ err: (err as Error).message }, 'object write failed');
      throw new ApiError(503, 'STORAGE_UNAVAILABLE', 'File storage is unavailable; nothing was saved');
    }
  }

  private async removeObjects(objects: Array<Pick<StoredObject, 'bucket' | 'key'>>): Promise<void> {
    for (const o of objects) {
      await this.storage.raw.remove(o.bucket, o.key).catch(() => undefined);
    }
  }

  /** Creates a Media row (with variants) after its objects are safely written. */
  async upload(input: UploadInput, ctx: RequestContext & { userId: string | null; email?: string | null }): Promise<UploadResult> {
    const id = uuidv7();
    const prepared = await this.prepare(input, { id, version: 1, date: new Date() });
    const duplicates = await this.db.media.findMany({
      where: { sha256: prepared.sha256 },
      select: { id: true },
      take: 20,
    });
    await this.writeObjects(prepared.objects);
    try {
      const row = await this.db.media.create({
        data: {
          id,
          kind: prepared.kind,
          visibility: prepared.visibility,
          bucket: prepared.bucket,
          objectKey: prepared.objectKey,
          originalName: prepared.originalName.slice(0, 255),
          mimeType: prepared.mime,
          sizeBytes: BigInt(prepared.sizeBytes),
          sha256: prepared.sha256,
          width: prepared.width,
          height: prepared.height,
          blurhash: prepared.blurhash,
          dominantColor: prepared.dominantColor,
          lqip: prepared.lqip,
          alt: input.alt ?? null,
          caption: input.caption ?? null,
          title: input.title ?? null,
          folderId: input.folderId ?? null,
          uploadedById: ctx.userId,
          version: 1,
          processingStatus: 'READY',
          variants: { create: prepared.variants.map((v) => ({ ...v, format: v.format })) },
        },
        include: { variants: true },
      });
      await this.audit.record({
        action: 'MEDIA_UPLOAD',
        summary: `Uploaded ${prepared.originalName}`,
        entityType: 'Media',
        entityId: id,
        actorId: ctx.userId,
        actorEmail: ctx.email ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return { media: row, sha256: prepared.sha256, duplicates: duplicates.map((d) => d.id) };
    } catch (err) {
      await this.removeObjects(prepared.objects);
      throw err;
    }
  }

  /** Replaces the file of an existing media item, keeping its id and bumping the version. */
  async replaceFile(mediaId: string, input: UploadInput, ctx: RequestContext & { userId: string | null; email?: string | null }): Promise<MediaRow> {
    const current = await this.db.media.findFirst({ where: { id: mediaId }, include: { variants: true } });
    if (!current) throw ApiError.notFound('Media');
    const version = current.version + 1;
    const prepared = await this.prepare({ ...input, intent: undefined }, { id: mediaId, version, date: current.createdAt });
    if (prepared.kind !== current.kind && !(current.kind === MediaKind.ICON && prepared.kind === MediaKind.IMAGE)) {
      throw ApiError.validation([{ field: 'file', message: `Replacement must be of the same kind (${current.kind})`, code: 'kind_mismatch' }]);
    }
    await this.writeObjects(prepared.objects);
    const row = await this.db.$transaction(async (tx) => {
      await tx.mediaVariant.deleteMany({ where: { mediaId } });
      return tx.media.update({
        where: { id: mediaId },
        data: {
          kind: prepared.kind,
          bucket: prepared.bucket,
          objectKey: prepared.objectKey,
          originalName: prepared.originalName.slice(0, 255),
          mimeType: prepared.mime,
          sizeBytes: BigInt(prepared.sizeBytes),
          sha256: prepared.sha256,
          width: prepared.width,
          height: prepared.height,
          blurhash: prepared.blurhash,
          dominantColor: prepared.dominantColor,
          lqip: prepared.lqip,
          version,
          variants: { create: prepared.variants },
        },
        include: { variants: true },
      });
    });
    // Old objects are removed only after the new version is recorded.
    const oldObjects: Array<{ bucket: string; key: string }> = [
      { bucket: current.bucket, key: current.objectKey },
      ...current.variants.map((v) => ({ bucket: current.bucket, key: v.objectKey })),
    ];
    await this.removeObjects(oldObjects);
    await this.audit.record({
      action: 'UPDATE',
      summary: `Replaced file of media ${mediaId} (v${version})`,
      entityType: 'Media',
      entityId: mediaId,
      actorId: ctx.userId,
      actorEmail: ctx.email ?? null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return row;
  }

  /** Stores a poster image for a video and returns the Media row. */
  async uploadPoster(input: UploadInput, ctx: RequestContext & { userId: string | null }): Promise<MediaRow> {
    if (!input.buffer.length) throw ApiError.validation([{ field: 'poster', message: 'Poster is empty' }]);
    return (await this.upload({ ...input, intent: 'IMAGE' }, ctx)).media;
  }

  async toDto(row: MediaRow): Promise<MediaDto> {
    return toMediaDto(row, this.config.env.PUBLIC_MEDIA_BASE_URL, this.config.env.API_PUBLIC_URL);
  }

  /** Batch loader used by read models: id -> DTO, READY variants only. */
  async resolveMany(ids: Array<string | null | undefined>): Promise<Map<string, MediaDto>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const map = new Map<string, MediaDto>();
    if (!unique.length) return map;
    const rows = await this.db.media.findMany({ where: { id: { in: unique } }, include: { variants: true } });
    for (const row of rows) map.set(row.id, toMediaDto(row, this.config.env.PUBLIC_MEDIA_BASE_URL, this.config.env.API_PUBLIC_URL));
    return map;
  }

  /** Physical deletion of a media item (objects and rows), after usage checks. */
  async purge(mediaId: string, force: boolean, ctx: RequestContext & { userId: string | null; email?: string | null }): Promise<void> {
    const row = await this.db.media.findFirst({ where: { id: mediaId }, include: { variants: true } });
    if (!row) throw ApiError.notFound('Media');
    const usage = await this.refs.usageOf(mediaId);
    if (usage.length && !force) {
      throw new ApiError(409, 'MEDIA_IN_USE', 'Media is used by other content', usage.map((u) => ({
        field: 'usage',
        message: `${u.entityType}:${u.entityId}`,
        code: u.field,
      })));
    }
    if (usage.length) {
      await this.db.$transaction([
        this.db.productImage.deleteMany({ where: { mediaId } }),
        this.db.productDocument.deleteMany({ where: { mediaId } }),
        this.db.heroSlide.deleteMany({ where: { imageMediaId: mediaId } }),
        this.db.mediaRef.deleteMany({ where: { mediaId } }),
      ]);
    }
    const objects = [{ bucket: row.bucket, key: row.objectKey }, ...row.variants.map((v) => ({ bucket: row.bucket, key: v.objectKey }))];
    await this.db.media.delete({ where: { id: mediaId } });
    await this.removeObjects(objects);
    await this.audit.record({
      action: 'MEDIA_DELETE',
      summary: `Deleted media ${row.originalName}${usage.length ? ' (forced)' : ''}`,
      entityType: 'Media',
      entityId: mediaId,
      actorId: ctx.userId,
      actorEmail: ctx.email ?? null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  /** Re-creates variants from the stored original (idempotent overwrite). */
  async regenerate(mediaId: string): Promise<MediaRow> {
    const row = await this.db.media.findFirst({ where: { id: mediaId }, include: { variants: true } });
    if (!row) throw ApiError.notFound('Media');
    if (row.kind !== MediaKind.IMAGE && row.kind !== MediaKind.ICON) return row;
    const stream = await this.storage.raw.read(row.bucket, row.objectKey);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    const analysis = await processImage(Buffer.concat(chunks), row.mimeType);
    const base = row.objectKey.replace(/\/original\.[a-z]+$/, '');
    const variants: Array<{ label: string; format: string; width: number; height: number; objectKey: string; sizeBytes: number }> = [];
    for (const v of analysis.variants) {
      const key = `${base}/${v.label}.${v.format}`;
      await this.storage.raw.put(row.bucket, key, v.data, `image/${v.format}`);
      variants.push({ label: v.label, format: v.format, width: v.width, height: v.height, objectKey: key, sizeBytes: v.data.length });
    }
    return this.db.$transaction(async (tx) => {
      await tx.mediaVariant.deleteMany({ where: { mediaId } });
      return tx.media.update({
        where: { id: mediaId },
        data: { blurhash: analysis.blurhash, dominantColor: analysis.dominantColor, lqip: analysis.lqip, variants: { create: variants } },
        include: { variants: true },
      });
    });
  }

  /** Dimensions helper for SVG/raster inputs supplied outside the upload path. */
  async dimensionsOf(buffer: Buffer): Promise<{ width: number; height: number } | null> {
    return imageSize(buffer);
  }

  /** Fetches the original bytes of a private document for the admin download route. */
  async originalStream(mediaId: string) {
    const row = await this.db.media.findFirst({ where: { id: mediaId } });
    if (!row) throw ApiError.notFound('Media');
    return { row, stream: await this.storage.raw.read(row.bucket, row.objectKey) };
  }

  static filterPrisma(q: { kind?: MediaKind; folderId?: string; visibility?: MediaVisibility; search?: string }): Prisma.MediaWhereInput {
    return {
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.folderId ? { folderId: q.folderId } : {}),
      ...(q.visibility ? { visibility: q.visibility } : {}),
      ...(q.search
        ? {
            OR: [
              { originalName: { contains: q.search, mode: 'insensitive' } },
              { alt: { contains: q.search, mode: 'insensitive' } },
              { title: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
}
