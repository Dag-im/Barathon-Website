import { Inject, Injectable } from '@nestjs/common';
import { RedirectMatch, RedirectType } from '@prisma/client';
import { ApiError } from '../common/utils/errors';
import { AppConfig, APP_CONFIG } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';

export const REDIRECT_TYPES: RedirectType[] = [RedirectType.MOVED_301, RedirectType.FOUND_302, RedirectType.TEMP_307, RedirectType.PERM_308];

/** Normalises a source path: leading slash, lowercase, no query, no trailing slash except root. */
export function normalisePath(raw: string): string {
  let p = raw.trim().split('?')[0].split('#')[0].toLowerCase();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

@Injectable()
export class RedirectsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  /** Targets are site paths or absolute https URLs on an allow-listed host (open-redirect guard). */
  validateTarget(target: string, source: string): string {
    const t = target.trim();
    if (!t) throw ApiError.validation([{ field: 'targetPath', message: 'Target is required' }]);
    if (t.startsWith('//') || /^javascript:/i.test(t)) {
      throw ApiError.validation([{ field: 'targetPath', message: 'Target is not allowed' }]);
    }
    if (t.startsWith('/')) {
      const normalised = normalisePath(t);
      if (normalised === source) throw ApiError.validation([{ field: 'targetPath', message: 'Target must differ from source' }]);
      return t;
    }
    let url: URL;
    try {
      url = new URL(t);
    } catch {
      throw ApiError.validation([{ field: 'targetPath', message: 'Target must be a path or an https URL' }]);
    }
    if (url.protocol !== 'https:' || !this.config.env.REDIRECT_ALLOWED_HOSTS.includes(url.hostname)) {
      throw ApiError.validation([{ field: 'targetPath', message: 'Absolute targets must be https on an allowed host' }]);
    }
    return t;
  }

  /** Walks the chain from target; a loop back to source is a REDIRECT_LOOP. */
  async assertNoLoop(source: string, target: string): Promise<void> {
    let current = normalisePath(target);
    for (let hop = 0; hop < 10; hop++) {
      if (current === source) throw new ApiError(409, 'REDIRECT_LOOP', 'This redirect would create a loop');
      const next = await this.db.redirect.findFirst({ where: { sourcePath: current, enabled: true } });
      if (!next) return;
      current = normalisePath(next.targetPath);
    }
  }

  async create(input: { sourcePath: string; targetPath: string; type?: RedirectType; matchType?: RedirectMatch; note?: string | null; auto?: boolean }) {
    const source = normalisePath(input.sourcePath);
    const target = this.validateTarget(input.targetPath, source);
    await this.assertNoLoop(source, target);
    const clash = await this.db.redirect.findFirst({ where: { sourcePath: source, matchType: input.matchType ?? 'EXACT' } });
    if (clash) throw ApiError.conflict('CONFLICT', 'A redirect already exists for this source');
    return this.db.redirect.create({
      data: {
        sourcePath: source,
        targetPath: target,
        type: input.type ?? RedirectType.MOVED_301,
        matchType: input.matchType ?? RedirectMatch.EXACT,
        note: input.note ?? null,
        auto: input.auto ?? false,
      },
    });
  }

  /** Automatic redirect on a slug change; collapses existing chains that pointed at the old path. */
  async addAuto(oldPath: string, newPath: string): Promise<void> {
    const source = normalisePath(oldPath);
    const target = normalisePath(newPath);
    if (source === target) return;
    await this.db.redirect.updateMany({ where: { targetPath: source }, data: { targetPath: target } });
    await this.db.redirect.deleteMany({ where: { sourcePath: source, matchType: 'EXACT' } });
    await this.db.redirect.create({
      data: { sourcePath: source, targetPath: target, type: RedirectType.MOVED_301, auto: true, note: 'Automatic: slug changed' },
    });
  }

  /** Resolves one path: exact match first, then the longest enabled prefix rule. */
  async resolve(path: string) {
    const p = normalisePath(path);
    const exact = await this.db.redirect.findFirst({ where: { sourcePath: p, matchType: 'EXACT', enabled: true } });
    if (exact) return { match: true as const, target: exact.targetPath, type: exact.type, id: exact.id };
    const prefixes = await this.db.redirect.findMany({ where: { matchType: 'PREFIX', enabled: true } });
    const hit = prefixes
      .filter((r: { sourcePath: string }) => p === r.sourcePath || p.startsWith(`${r.sourcePath}/`))
      .sort((a: { sourcePath: string }, b: { sourcePath: string }) => b.sourcePath.length - a.sourcePath.length)[0];
    if (hit) {
      const rest = p.slice(hit.sourcePath.length);
      return { match: true as const, target: `${hit.targetPath.replace(/\/$/, '')}${rest}`, type: hit.type, id: hit.id };
    }
    return { match: false as const };
  }

  /** Follows the chain for the admin test tool and reports loops. */
  async chain(path: string): Promise<{ chain: string[]; loop: boolean }> {
    const chain = [normalisePath(path)];
    let loop = false;
    for (let i = 0; i < 10; i++) {
      const r = await this.resolve(chain[chain.length - 1]);
      if (!r.match) break;
      if (chain.includes(normalisePath(r.target))) {
        loop = true;
        break;
      }
      chain.push(normalisePath(r.target));
    }
    return { chain, loop };
  }

  async enabledRules() {
    const rows = await this.db.redirect.findMany({ where: { enabled: true }, orderBy: { sourcePath: 'asc' } });
    return rows.map((r: { sourcePath: string; targetPath: string; type: RedirectType; matchType: RedirectMatch }) => ({
      source: r.sourcePath,
      target: r.targetPath,
      type: r.type,
      match: r.matchType,
    }));
  }
}
