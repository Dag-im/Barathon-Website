import { Injectable } from '@nestjs/common';
import { MenuItemType, MenuLocation } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../common/utils/errors';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { tagsFor } from '../common/constants/revalidation-map';
import { LIVE, assertLive } from '../common/content/refs';

export const LOCATIONS = Object.values(MenuLocation) as MenuLocation[];

export interface MenuItemInput {
  id?: string;
  type: MenuItemType;
  label: string;
  pageId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  href?: string | null;
  target?: 'SELF' | 'BLANK';
  icon?: string | null;
  config?: Record<string, unknown> | null;
  visible?: boolean;
  children?: MenuItemInput[];
}

export const menuItemSchema: z.ZodType<MenuItemInput> = z.lazy(() =>
  z
    .object({
      id: z.string().uuid().optional(),
      type: z.nativeEnum(MenuItemType),
      label: z.string().trim().min(1).max(80),
      pageId: z.string().uuid().nullable().optional(),
      entityType: z.string().nullable().optional(),
      entityId: z.string().uuid().nullable().optional(),
      href: z.string().max(500).nullable().optional(),
      target: z.enum(['SELF', 'BLANK']).optional(),
      icon: z.string().max(40).nullable().optional(),
      config: z.record(z.unknown()).nullable().optional(),
      visible: z.boolean().optional(),
      children: z.array(menuItemSchema).max(30).optional(),
    })
    .strict(),
) as z.ZodType<MenuItemInput>;

const ENTITY_PATHS: Record<string, (slug: string) => string> = {
  PRODUCT: (s) => `/products/${s}`,
  BRAND: (s) => `/brands/${s}`,
  SERVICE: (s) => `/services/${s}`,
  POST: (s) => `/news/${s}`,
  PAGE: (s) => (s === 'home' ? '/' : `/${s}`),
  SUBSIDIARY: (s) => `/about#${s}`,
};

const SAFE_HREF = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+|tel:[^\s]+|mailto:[^\s]+|#[^\s]*)$/;

function depthOf(items: MenuItemInput[], depth = 1): number {
  if (!items.length) return depth - 1;
  return Math.max(...items.map((i) => (i.children?.length ? depthOf(i.children, depth + 1) : depth)));
}

@Injectable()
export class NavigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reval: RevalidationService,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  async ensureMenus(): Promise<void> {
    const titles: Record<MenuLocation, string> = { HEADER: 'Header', FOOTER_QUICK: 'Footer quick links', FOOTER_PRODUCTS: 'Footer products', FOOTER_LEGAL: 'Footer legal' };
    for (const loc of LOCATIONS) {
      await this.db.menu.upsert({ where: { location: loc }, create: { location: loc, title: titles[loc] }, update: {} });
    }
  }

  private async tree(menuId: string) {
    const rows = await this.db.menuItem.findMany({ where: { menuId }, orderBy: [{ sortOrder: 'asc' }] });
    const build = (parentId: string | null): unknown[] =>
      rows
        .filter((r: any) => (r.parentId ?? null) === parentId)
        .map((r: any) => ({
          id: r.id,
          type: r.type,
          label: r.label,
          pageId: r.pageId,
          entityType: r.entityType,
          entityId: r.entityId,
          href: r.href,
          target: r.target,
          icon: r.icon,
          config: r.config,
          visible: r.visible,
          children: build(r.id),
        }));
    return build(null);
  }

  async adminMenu(location: MenuLocation) {
    await this.ensureMenus();
    const menu = await this.db.menu.findUniqueOrThrow({ where: { location } });
    return { location, title: menu.title, items: await this.tree(menu.id) };
  }

  async adminAll() {
    await this.ensureMenus();
    return { data: await Promise.all(LOCATIONS.map((l) => this.adminMenu(l))) };
  }

  /** Replaces the whole menu atomically after validating types, references and depth. */
  async replace(location: MenuLocation, items: MenuItemInput[]) {
    if (depthOf(items) > 2) throw ApiError.validation([{ field: 'items', message: 'Menus support at most two levels of nesting', code: 'depth' }]);
    await this.validateItems(items, 'items');
    await this.ensureMenus();
    const menu = await this.db.menu.findUniqueOrThrow({ where: { location } });
    await this.db.$transaction(async (tx: any) => {
      await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
      const insert = async (list: MenuItemInput[], parentId: string | null) => {
        for (let n = 0; n < list.length; n++) {
          const i = list[n];
          const created = await tx.menuItem.create({
            data: {
              menuId: menu.id,
              parentId,
              type: i.type,
              label: i.label,
              pageId: i.pageId ?? null,
              entityType: (i.entityType as any) ?? null,
              entityId: i.entityId ?? null,
              href: i.href ?? null,
              target: i.target ?? 'SELF',
              icon: i.icon ?? null,
              config: (i.config as any) ?? undefined,
              visible: i.visible ?? true,
              sortOrder: n,
            },
          });
          if (i.children?.length) await insert(i.children, created.id);
        }
      };
      await insert(items, null);
      await tx.menu.update({ where: { id: menu.id }, data: { updatedAt: new Date() } });
    });
    const t = tagsFor('menu');
    this.reval.enqueue(t.tags, t.paths);
    return this.adminMenu(location);
  }

  private async validateItems(items: MenuItemInput[], path: string): Promise<void> {
    for (const [idx, i] of items.entries()) {
      const at = `${path}[${idx}]`;
      if (i.type === MenuItemType.PAGE && !i.pageId) throw ApiError.validation([{ field: `${at}.pageId`, message: 'Page items need a page' }]);
      if (i.type === MenuItemType.PAGE) await assertLive(this.prisma, 'page', i.pageId, `${at}.pageId`);
      if (i.type === MenuItemType.ENTITY) {
        if (!i.entityType || !i.entityId) throw ApiError.validation([{ field: `${at}.entityId`, message: 'Entity items need a type and id' }]);
        const model = { PRODUCT: 'product', BRAND: 'brand', SERVICE: 'service', POST: 'post', SUBSIDIARY: 'subsidiary', PAGE: 'page' }[i.entityType];
        if (model) await assertLive(this.prisma, model, i.entityId, `${at}.entityId`);
      }
      if (i.type === MenuItemType.CUSTOM) {
        if (!i.href || !SAFE_HREF.test(i.href)) throw ApiError.validation([{ field: `${at}.href`, message: 'Use a site path, https URL, tel: or mailto: link' }]);
      }
      if (i.children?.length) await this.validateItems(i.children, `${at}.children`);
    }
  }

  private async hrefFor(item: any): Promise<string> {
    if (item.type === 'PAGE' && item.pageId) {
      const page = await this.db.page.findFirst({ where: { id: item.pageId } });
      return page ? ENTITY_PATHS.PAGE(page.slug) : '/';
    }
    if (item.type === 'ENTITY' && item.entityType && item.entityId) {
      const model = { PRODUCT: 'product', BRAND: 'brand', SERVICE: 'service', POST: 'post', SUBSIDIARY: 'subsidiary', PAGE: 'page' }[item.entityType as string];
      const row = model ? await (this.db as any)[model].findFirst({ where: { id: item.entityId }, select: { slug: true } }) : null;
      return row ? ENTITY_PATHS[item.entityType as string](row.slug) : '#';
    }
    return item.href ?? '#';
  }

  /** Public menu: visible items only; dynamic product items expand to live products. */
  private async publicItems(list: any[]): Promise<any[]> {
    const out: any[] = [];
    for (const item of list.filter((i) => i.visible)) {
      if (item.type === 'DYNAMIC_PRODUCTS') {
        const cfg = (item.config ?? {}) as { limit?: number; viewAllLabel?: string; showViewAll?: boolean };
        const limit = Math.min(Math.max(cfg.limit ?? 8, 1), 50);
        const rows = await this.db.product.findMany({ where: LIVE(), orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }], take: limit, select: { title: true, slug: true, id: true } });
        out.push({
          id: item.id,
          label: item.label,
          href: '/products',
          target: item.target,
          icon: item.icon,
          children: rows.map((r: any) => ({ id: r.id, label: r.title, href: `/products/${r.slug}`, target: 'SELF', icon: null, children: [] })),
          ...(cfg.showViewAll !== false ? { viewAll: { label: cfg.viewAllLabel ?? 'All products', href: '/products' } } : {}),
        });
        continue;
      }
      const href = await this.hrefFor(item);
      out.push({ id: item.id, label: item.label, href, target: item.target, icon: item.icon, children: await this.publicItems(item.children ?? []) });
    }
    return out;
  }

  async publicMenu(location: MenuLocation) {
    await this.ensureMenus();
    const menu = await this.db.menu.findUnique({ where: { location } });
    if (!menu) return { location, items: [] };
    const tree = (await this.tree(menu.id)) as any[];
    return { location, items: await this.publicItems(tree) };
  }

  async publicAll(): Promise<Record<MenuLocation, any[]>> {
    const out = {} as Record<MenuLocation, any[]>;
    for (const loc of LOCATIONS) out[loc] = (await this.publicMenu(loc)).items;
    return out;
  }
}

