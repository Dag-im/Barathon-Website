import { Injectable } from '@nestjs/common';
import { PageBlock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { LIVE } from '../common/content/refs';
import { mediaOf } from '../catalogue/shared';
import { BrandsService } from '../catalogue/brands';
import { ProductsReadService } from '../catalogue/products.read';
import { VideosReadService } from '../catalogue/videos.read';
import { ServicesService } from '../catalogue/services';
import { SubsidiariesService } from '../catalogue/subsidiaries';
import { SettingsService } from '../settings/settings.service';

/** Turns stored block data into the public block shape (backend-plan 6.2 / 10.5). */
@Injectable()
export class BlocksResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly brands: BrandsService,
    private readonly products: ProductsReadService,
    private readonly videos: VideosReadService,
    private readonly services: ServicesService,
    private readonly subsidiaries: SubsidiariesService,
    private readonly settings: SettingsService,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  async resolve(block: PageBlock): Promise<Record<string, unknown>> {
    const d = (block.data ?? {}) as Record<string, any>;
    const base = {
      id: block.id,
      type: block.type,
      anchorId: block.anchorId,
      navLabel: block.navLabel,
      showInTabNav: block.showInTabNav,
      title: d.title,
      subtitle: d.subtitle,
      background: d.background,
      spacing: d.spacing,
    };
    const extra = await this.body(block.type, d);
    return { ...base, ...extra };
  }

  private async body(type: PageBlock['type'], d: Record<string, any>): Promise<Record<string, unknown>> {
    switch (type) {
      case 'HERO_CAROUSEL': {
        const limit = d.limit ?? 8;
        let slides: any[];
        if (d.source === 'HERO_SLIDES') {
          const now = new Date();
          const rows = await this.db.heroSlide.findMany({
            where: { visible: true, status: 'PUBLISHED', AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
            orderBy: { sortOrder: 'asc' },
            take: limit,
          });
          const media = await this.media.resolveMany(rows.flatMap((r: any) => [r.imageMediaId, r.mobileImageMediaId]));
          slides = rows.map((r: any) => ({
            id: r.id,
            eyebrow: r.eyebrow,
            heading: r.heading,
            subheading: r.subheading,
            image: mediaOf(media, r.imageMediaId),
            mobileImage: mediaOf(media, r.mobileImageMediaId),
            overlayOpacity: r.overlayOpacity,
            buttons: [r.button1Label && r.button1Href ? { label: r.button1Label, href: r.button1Href } : null, r.button2Label && r.button2Href ? { label: r.button2Label, href: r.button2Href } : null].filter(Boolean),
            href: null,
          }));
        } else {
          const products = await this.products.cards(
            await this.db.product.findMany({ where: { ...LIVE(), isFeatured: true }, include: { brand: { select: { id: true, name: true, slug: true, logoMediaId: true } }, category: { select: { id: true, name: true, slug: true } } }, orderBy: { sortOrder: 'asc' }, take: limit }),
          );
          const media = await this.media.resolveMany(products.map((p: any) => p.image?.id));
          slides = products.map((p: any) => ({
            id: p.id,
            eyebrow: p.category?.name ?? null,
            heading: p.title,
            subheading: p.shortDescription,
            image: p.image,
            mobileImage: null,
            overlayOpacity: 40,
            buttons: [{ label: 'Learn more', href: p.href }],
            href: p.href,
          }));
          void media;
        }
        return { autoplayMs: d.autoplayMs ?? 6000, showThumbnails: d.showThumbnails ?? true, showCounter: d.showCounter ?? true, slides };
      }
      case 'BRANDS_MARQUEE':
        return { speed: d.speed ?? 'NORMAL', linkToBrand: d.linkToBrand ?? true, grayscale: d.grayscale ?? false, brands: await this.brands.marquee(d.mode === 'SELECTED' ? d.brandIds ?? [] : undefined) };
      case 'BRAND_GRID': {
        const brands = await this.brands.marquee(d.mode === 'SELECTED' ? d.brandIds ?? [] : undefined);
        return { columns: d.columns ?? 4, brands };
      }
      case 'IMAGE_TEXT': {
        const map = await this.media.resolveMany([d.imageMediaId]);
        return { image: mediaOf(map, d.imageMediaId), imagePosition: d.imagePosition ?? 'LEFT', heading: d.heading ?? null, bodyHtml: d.bodyHtml ?? '', buttons: (d.buttons ?? []).map((b: any) => ({ ...b, variant: b.variant ?? 'PRIMARY', target: b.target ?? 'SELF' })) };
      }
      case 'STATS': {
        const rows = await this.db.stat.findMany({
          where: { visible: true, ...(d.mode === 'SELECTED' ? { id: { in: d.statIds ?? [] } } : {}), ...(d.group ? { group: d.group } : {}) },
          orderBy: { sortOrder: 'asc' },
        });
        return { stats: rows.map((r: any) => ({ id: r.id, value: r.value, prefix: r.prefix, suffix: r.suffix, label: r.label, icon: r.icon })) };
      }
      case 'FEATURED_PRODUCTS': {
        const where: Record<string, unknown> = { ...LIVE() };
        if (d.mode === 'SELECTED') where.id = { in: d.productIds ?? [] };
        else if (d.mode === 'CATEGORY') where.categoryId = d.categoryId ?? null;
        else where.isFeatured = true;
        const rows = await this.db.product.findMany({ where, include: { brand: { select: { id: true, name: true, slug: true, logoMediaId: true } }, category: { select: { id: true, name: true, slug: true } } }, orderBy: { sortOrder: 'asc' }, take: d.limit ?? 8 });
        return { layout: d.layout ?? 'GRID', products: await this.products.cards(rows), viewAll: d.viewAllLabel ? { label: d.viewAllLabel, href: d.viewAllHref ?? '/products' } : undefined };
      }
      case 'VIDEOS_GRID':
        return { videos: await this.videos.grid({ mode: d.mode ?? 'FEATURED', ids: d.videoIds, limit: d.limit ?? 6 }) };
      case 'SERVICES_GRID': {
        const list = d.mode === 'SELECTED' ? await this.services.servicesByIds(d.serviceIds ?? []) : (await this.services.listPublic()).data;
        return { services: list.slice(0, d.limit ?? 6), cta: d.ctaLabel ? { label: d.ctaLabel, href: d.ctaHref ?? '/services' } : undefined };
      }
      case 'TESTIMONIALS': {
        const rows = await this.db.testimonial.findMany({ where: { ...LIVE(), ...(d.mode === 'SELECTED' ? { id: { in: d.testimonialIds ?? [] } } : {}) }, orderBy: { sortOrder: 'asc' }, take: d.limit ?? 6 });
        const media = await this.media.resolveMany(rows.map((r: any) => r.photoMediaId));
        return { layout: d.layout ?? 'CAROUSEL', testimonials: rows.map((r: any) => ({ id: r.id, quote: r.quote, personName: r.personName, personRole: r.personRole, companyName: r.companyName, photo: mediaOf(media, r.photoMediaId), rating: r.rating })) };
      }
      case 'LATEST_POSTS': {
        const rows = await this.db.post.findMany({ where: { ...LIVE(), ...(d.categoryId ? { categoryId: d.categoryId } : {}) }, orderBy: { publishedAt: 'desc' }, take: d.limit ?? 3, include: { category: { select: { name: true, slug: true } } } });
        const { postCards } = await import('../editorial/posts.read');
        return { posts: await postCards(this.prisma, this.media, rows) , viewAll: d.viewAllLabel ? { label: d.viewAllLabel, href: '/news' } : undefined };
      }
      case 'CTA_BANNER': {
        const map = await this.media.resolveMany([d.backgroundMediaId]);
        return { heading: d.heading, text: d.text ?? null, backgroundImage: mediaOf(map, d.backgroundMediaId), buttons: d.buttons ?? [] };
      }
      case 'TIMELINE': {
        const rows = await this.db.timelineEntry.findMany({ where: { visible: true, ...(d.mode === 'SELECTED' ? { id: { in: d.entryIds ?? [] } } : {}) }, orderBy: [{ sortOrder: 'asc' }, { startYear: 'asc' }] });
        const media = await this.media.resolveMany(rows.map((r: any) => r.imageMediaId));
        return { orientation: d.orientation ?? 'VERTICAL', entries: rows.map((r: any) => ({ id: r.id, yearLabel: r.yearLabel, title: r.title, descriptionHtml: r.description ?? '', image: mediaOf(media, r.imageMediaId), icon: r.icon })) };
      }
      case 'LEADER_MESSAGE': {
        const row = d.leaderMessageId ? await this.db.leaderMessage.findFirst({ where: { id: d.leaderMessageId, status: 'PUBLISHED' } }) : await this.db.leaderMessage.findFirst({ where: { isPrimary: true, status: 'PUBLISHED' } });
        if (!row) return { leader: null };
        const media = await this.media.resolveMany([row.photoMediaId, row.signatureMediaId]);
        return { leader: { id: row.id, heading: row.heading, name: row.name, jobTitle: row.jobTitle, photo: mediaOf(media, row.photoMediaId), signature: mediaOf(media, row.signatureMediaId), messageHtml: row.messageHtml } };
      }
      case 'MISSION_VISION': {
        const items = await this.db.coreValue.findMany({ where: { group: 'MISSION', status: 'PUBLISHED', ...(d.missionMode === 'SELECTED' ? { id: { in: d.missionIds ?? [] } } : {}) }, orderBy: { sortOrder: 'asc' } });
        return { missionTitle: d.missionTitle ?? 'Mission', visionTitle: d.visionTitle ?? 'Vision', visionHtml: d.visionHtml ?? '', missionItems: items.map(coreValueDto) };
      }
      case 'CORE_VALUES': {
        const items = await this.db.coreValue.findMany({ where: { group: 'VALUE', status: 'PUBLISHED', ...(d.mode === 'SELECTED' ? { id: { in: d.valueIds ?? [] } } : {}) }, orderBy: { sortOrder: 'asc' } });
        return { layout: d.layout ?? 'CARDS', values: items.map(coreValueDto) };
      }
      case 'SUBSIDIARIES':
        return { layout: d.layout ?? 'TABS', subsidiaries: await this.subsidiaries.publicList(d.mode === 'SELECTED' ? d.subsidiaryIds ?? [] : undefined) };
      case 'TEAM': {
        const rows = await this.db.teamMember.findMany({ where: { status: 'PUBLISHED', ...(d.mode === 'SELECTED' ? { id: { in: d.memberIds ?? [] } } : {}) }, orderBy: { sortOrder: 'asc' } });
        const media = await this.media.resolveMany(rows.map((r: any) => r.photoMediaId));
        return { members: rows.map((r: any) => ({ id: r.id, name: r.name, jobTitle: r.jobTitle, bioHtml: r.bioHtml, photo: mediaOf(media, r.photoMediaId) })) };
      }
      case 'FAQ': {
        const groups = await this.db.faqGroup.findMany({ where: { status: 'PUBLISHED', deletedAt: null, ...(d.groupId ? { id: d.groupId } : {}) }, orderBy: { sortOrder: 'asc' }, include: { faqs: { where: { status: 'PUBLISHED', deletedAt: null }, orderBy: { sortOrder: 'asc' } } } });
        return { groups: groups.map((g: any) => ({ id: g.id, slug: g.slug, title: g.title, items: g.faqs.map((f: any) => ({ id: f.id, question: f.question, answerHtml: f.answerHtml })) })) };
      }
      case 'RICH_TEXT':
        return { html: d.html ?? '' };
      case 'IMAGE_GALLERY': {
        const ids = (d.images ?? []).map((i: any) => i.mediaId);
        const map = await this.media.resolveMany(ids);
        return { columns: d.columns ?? 3, images: ids.map((id: string) => mediaOf(map, id)).filter(Boolean) };
      }
      case 'CONTACT_STRIP': {
        const site = await this.settings.publicCore();
        void site;
        const channels = await this.db.contactChannel.findMany({ where: { visible: true, showOnContactPage: true }, orderBy: { sortOrder: 'asc' } });
        const offices = await this.db.office.findMany({ where: { visible: true }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] });
        return { buttonLabel: d.buttonLabel ?? null, buttonHref: d.buttonHref ?? null, channels: channels.map((c: any) => ({ id: c.id, type: c.type, label: c.label, value: c.value, displayValue: c.displayValue ?? c.value })), offices: offices.map((o: any) => ({ id: o.id, name: o.name, isPrimary: o.isPrimary, city: o.city, countryName: o.countryName })) };
      }
      default:
        return {};
    }
  }
}

function coreValueDto(c: any) {
  return { id: c.id, group: c.group, title: c.title, description: c.description ?? null, icon: c.icon ?? null };
}
