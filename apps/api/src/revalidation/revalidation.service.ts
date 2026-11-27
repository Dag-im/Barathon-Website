import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { AppConfig, APP_CONFIG } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';

const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 120_000, 600_000];
const DEBOUNCE_MS = 2_000;

/**
 * Coalesces cache-invalidation requests and POSTs a signed payload to the web app.
 * Failures never block admin writes; every attempt series is recorded in RevalidationLog.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger('Revalidation');
  private pendingTags = new Set<string>();
  private pendingPaths = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  get enabled(): boolean {
    return !!this.config.env.WEB_REVALIDATE_URL && !!this.config.env.REVALIDATE_SECRET;
  }

  /** Queues tags and paths; the actual request is sent after a short debounce window. */
  enqueue(tags: string[], paths: string[] = []): void {
    if (!this.enabled || (!tags.length && !paths.length)) return;
    tags.forEach((t) => this.pendingTags.add(t));
    paths.forEach((p) => this.pendingPaths.add(p));
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
    this.timer.unref?.();
  }

  private async flush(): Promise<void> {
    const tags = [...this.pendingTags];
    const paths = [...this.pendingPaths];
    this.pendingTags = new Set();
    this.pendingPaths = new Set();
    this.timer = null;
    if (tags.length || paths.length) await this.send({ tags, paths }, 0);
  }

  /** Immediate broadcast used by the admin "revalidate all" action. */
  async revalidateAll(): Promise<void> {
    await this.send({ tags: ['site', 'pages', 'products', 'brands', 'services', 'videos', 'posts', 'faqs', 'testimonials', 'subsidiaries', 'leadership', 'timeline', 'stats', 'hero', 'redirects', 'sitemap', 'menus', 'categories'], paths: ['/'] }, 0);
  }

  private async send(payload: { tags: string[]; paths: string[] }, attempt: number): Promise<void> {
    const body = JSON.stringify({ ...payload, ts: Math.floor(Date.now() / 1000) });
    const ts = Date.now().toString();
    const signature = createHmac('sha256', this.config.env.REVALIDATE_SECRET).update(`${ts}.${body}`).digest('hex');
    let status: number | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(this.config.env.WEB_REVALIDATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Revalidate-Signature': `sha256=${signature}`,
          'X-Revalidate-Timestamp': ts,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      status = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = (err as Error).message;
    }

    if (!error) {
      await this.log(payload, 'OK', status, attempt + 1, null);
      return;
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      setTimeout(() => void this.send(payload, attempt + 1), RETRY_DELAYS_MS[attempt]).unref?.();
      return;
    }
    this.logger.warn(`revalidation failed after ${attempt + 1} attempts: ${error}`);
    await this.log(payload, 'FAILED', status, attempt + 1, error);
  }

  private async log(payload: { tags: string[]; paths: string[] }, status: string, httpStatus: number | null, attempts: number, error: string | null) {
    try {
      await this.prisma.client.revalidationLog.create({
        data: { tags: payload.tags, paths: payload.paths, status, httpStatus, attempts, error },
      });
    } catch {
      // Logging failures are not fatal.
    }
  }
}
