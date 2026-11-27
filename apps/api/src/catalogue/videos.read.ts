import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { AppConfig, APP_CONFIG } from '../config/config';
import { LIVE } from '../common/content/refs';
import { mediaOf, videoObjectJsonLd } from './shared';
import { youtubeEmbedUrl, youtubeThumbUrl } from './youtube';

const VIDEO_INCLUDE = { brand: { select: { id: true, name: true, slug: true } }, product: { select: { id: true, title: true, slug: true } } };

/** Public projection of videos: YouTube (nocookie embed) and uploaded files (native player). */
@Injectable()
export class VideosReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async toDtos(rows: any[]) {
    const media = await this.media.resolveMany(rows.flatMap((r) => [r.posterMediaId, r.mediaId]));
    return rows.map((r) => this.dto(r, media));
  }

  dto(row: any, media: Map<string, any>) {
    const poster = mediaOf(media, row.posterMediaId);
    const isYoutube = row.sourceType === 'YOUTUBE';
    const posterUrl = poster?.url ?? (isYoutube && row.youtubeId ? youtubeThumbUrl(row.youtubeId) : null);
    const mediaUrl = !isYoutube ? mediaOf(media, row.mediaId)?.url ?? null : null;
    const embedUrl = isYoutube && row.youtubeId ? youtubeEmbedUrl(row.youtubeId, row.startSeconds) : null;
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      sourceType: row.sourceType as 'UPLOAD' | 'YOUTUBE',
      youtubeId: isYoutube ? row.youtubeId : null,
      startSeconds: row.startSeconds ?? null,
      embedUrl,
      mediaUrl,
      posterUrl,
      thumbnailUrl: posterUrl,
      thumbnail: poster,
      mimeType: row.mimeType ?? null,
      sizeBytes: row.sizeBytes !== null && row.sizeBytes !== undefined ? Number(row.sizeBytes) : null,
      durationSeconds: row.durationSeconds ?? null,
      brand: row.brand ? { slug: row.brand.slug, name: row.brand.name } : null,
      product: row.product ? { slug: row.product.slug, title: row.product.title } : null,
      isFeatured: row.isFeatured,
      jsonLd: videoObjectJsonLd({
        title: row.title,
        description: row.description ?? null,
        posterUrl,
        sourceType: row.sourceType,
        embedUrl,
        mediaUrl,
        publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
        siteUrl: this.config.env.PUBLIC_SITE_URL,
      }),
    };
  }

  private live(extra: Record<string, unknown>) {
    return { ...LIVE(), ...extra };
  }

  async forBrand(brandId: string) {
    const rows = await this.prisma.client.video.findMany({
      where: this.live({ brandId }),
      include: VIDEO_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return this.toDtos(rows);
  }

  async forProduct(productId: string) {
    const rows = await this.prisma.client.video.findMany({
      where: this.live({ productId }),
      include: VIDEO_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return this.toDtos(rows);
  }

  /** Home "Featured Videos": featured live videos, or a hand-picked list when ids are given. */
  async grid(opts: { mode: 'FEATURED' | 'SELECTED' | 'ALL'; ids?: string[]; limit: number }) {
    const where =
      opts.mode === 'SELECTED' ? this.live({ id: { in: opts.ids ?? [] } }) : opts.mode === 'FEATURED' ? this.live({ isFeatured: true }) : this.live({});
    const rows = await this.prisma.client.video.findMany({ where, include: VIDEO_INCLUDE, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], take: opts.limit });
    const dtos = await this.toDtos(rows);
    if (opts.mode === 'SELECTED' && opts.ids?.length) {
      return opts.ids.map((id) => dtos.find((d) => d.id === id)).filter(Boolean) as typeof dtos;
    }
    return dtos;
  }

  async listPublic(q: { featured?: boolean; brand?: string; product?: string; page: number; pageSize: number }) {
    const where = this.live({
      ...(q.featured !== undefined ? { isFeatured: q.featured } : {}),
      ...(q.brand ? { brand: { slug: q.brand.toLowerCase() } } : {}),
      ...(q.product ? { product: { slug: q.product.toLowerCase() } } : {}),
    });
    const [rows, total] = await Promise.all([
      this.prisma.client.video.findMany({ where, include: VIDEO_INCLUDE, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.client.video.count({ where }),
    ]);
    const data = await this.toDtos(rows);
    return { data, meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } };
  }

  async getPublic(id: string) {
    const row = await this.prisma.client.video.findFirst({ where: this.live({ id }), include: VIDEO_INCLUDE });
    if (!row) return null;
    const [dto] = await this.toDtos([row]);
    return dto;
  }

  /** Streams an uploaded video with HTTP range support (used when no reverse proxy serves /media). */
  async uploadedMediaKey(id: string): Promise<{ bucket: string; key: string; mime: string } | null> {
    const row = await this.prisma.client.video.findFirst({ where: this.live({ id, sourceType: 'UPLOAD' }) });
    if (!row?.mediaId) return null;
    const m = await this.prisma.client.media.findFirst({ where: { id: row.mediaId } });
    return m ? { bucket: m.bucket, key: m.objectKey, mime: m.mimeType } : null;
  }
}
