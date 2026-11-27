import { z } from 'zod';
import { BlockType } from '@prisma/client';

const id = z.string().uuid();
const common = {
  title: z.string().max(160).optional(),
  subtitle: z.string().max(300).optional(),
  background: z.enum(['DEFAULT', 'MUTED', 'DARK', 'BRAND']).optional(),
  spacing: z.enum(['NONE', 'SM', 'MD', 'LG']).optional(),
};
const button = z.object({ label: z.string().min(1).max(60), href: z.string().min(1).max(500), variant: z.enum(['PRIMARY', 'SECONDARY', 'LINK']).default('PRIMARY'), target: z.enum(['SELF', 'BLANK']).default('SELF') }).strict();
const mode = z.enum(['ALL', 'SELECTED']);

/** Zod schema per block type; unknown keys are rejected (backend-plan 3.9.1). */
export const blockSchemas: Record<BlockType, z.ZodTypeAny> = {
  HERO_CAROUSEL: z.object({ ...common, source: z.enum(['HERO_SLIDES', 'FEATURED_PRODUCTS']), autoplayMs: z.number().int().min(2000).max(20000).default(6000), showThumbnails: z.boolean().default(true), showCounter: z.boolean().default(true), limit: z.number().int().min(1).max(12).default(8) }).strict(),
  BRANDS_MARQUEE: z.object({ ...common, mode, brandIds: z.array(id).max(60).default([]), speed: z.enum(['SLOW', 'NORMAL', 'FAST']).default('NORMAL'), linkToBrand: z.boolean().default(true), grayscale: z.boolean().default(false) }).strict(),
  BRAND_GRID: z.object({ ...common, mode, brandIds: z.array(id).max(60).default([]), columns: z.number().int().min(2).max(6).default(4) }).strict(),
  IMAGE_TEXT: z.object({ ...common, imageMediaId: id.nullable().default(null), imagePosition: z.enum(['LEFT', 'RIGHT', 'TOP']).default('LEFT'), heading: z.string().max(200).nullable().default(null), bodyHtml: z.string().max(100_000).default(''), buttons: z.array(button).max(3).default([]) }).strict(),
  STATS: z.object({ ...common, mode, statIds: z.array(id).max(20).default([]), group: z.string().max(40).optional() }).strict(),
  FEATURED_PRODUCTS: z.object({ ...common, mode: z.enum(['FEATURED_FLAG', 'SELECTED', 'CATEGORY']).default('FEATURED_FLAG'), productIds: z.array(id).max(24).default([]), categoryId: id.optional(), limit: z.number().int().min(1).max(24).default(8), layout: z.enum(['GRID', 'CAROUSEL']).default('GRID'), viewAllLabel: z.string().max(60).optional(), viewAllHref: z.string().max(300).optional() }).strict(),
  VIDEOS_GRID: z.object({ ...common, mode: z.enum(['FEATURED', 'SELECTED', 'ALL']).default('FEATURED'), videoIds: z.array(id).max(24).default([]), limit: z.number().int().min(1).max(24).default(6), layout: z.enum(['GRID', 'CAROUSEL']).default('GRID') }).strict(),
  SERVICES_GRID: z.object({ ...common, mode, serviceIds: z.array(id).max(20).default([]), limit: z.number().int().min(1).max(20).default(6), ctaLabel: z.string().max(60).optional(), ctaHref: z.string().max(300).optional() }).strict(),
  TESTIMONIALS: z.object({ ...common, mode, testimonialIds: z.array(id).max(20).default([]), limit: z.number().int().min(1).max(20).default(6), layout: z.enum(['CAROUSEL', 'GRID']).default('CAROUSEL') }).strict(),
  LATEST_POSTS: z.object({ ...common, limit: z.number().int().min(1).max(12).default(3), categoryId: id.optional(), viewAllLabel: z.string().max(60).optional() }).strict(),
  CTA_BANNER: z.object({ ...common, heading: z.string().min(1).max(200), text: z.string().max(500).optional(), backgroundMediaId: id.optional(), buttons: z.array(button).max(2).default([]) }).strict(),
  TIMELINE: z.object({ ...common, mode, entryIds: z.array(id).max(50).default([]), orientation: z.enum(['VERTICAL', 'HORIZONTAL']).default('VERTICAL') }).strict(),
  LEADER_MESSAGE: z.object({ ...common, leaderMessageId: id.nullable().default(null) }).strict(),
  MISSION_VISION: z.object({ ...common, missionTitle: z.string().max(120).default('Mission'), visionTitle: z.string().max(120).default('Vision'), visionHtml: z.string().max(20_000).default(''), missionMode: mode.default('ALL'), missionIds: z.array(id).max(20).default([]) }).strict(),
  CORE_VALUES: z.object({ ...common, mode, valueIds: z.array(id).max(20).default([]), layout: z.enum(['CARDS', 'LIST']).default('CARDS') }).strict(),
  SUBSIDIARIES: z.object({ ...common, mode, subsidiaryIds: z.array(id).max(10).default([]), layout: z.enum(['TABS', 'STACKED']).default('TABS') }).strict(),
  TEAM: z.object({ ...common, mode, memberIds: z.array(id).max(30).default([]) }).strict(),
  FAQ: z.object({ ...common, groupId: id.nullable().default(null) }).strict(),
  RICH_TEXT: z.object({ ...common, html: z.string().max(200_000).default('') }).strict(),
  IMAGE_GALLERY: z.object({ ...common, images: z.array(z.object({ mediaId: id, caption: z.string().max(300).optional() }).strict()).max(24).default([]), columns: z.number().int().min(2).max(4).default(3) }).strict(),
  CONTACT_STRIP: z.object({ ...common, showPhones: z.boolean().default(true), showEmail: z.boolean().default(true), showAddress: z.boolean().default(true), buttonLabel: z.string().max(60).optional(), buttonHref: z.string().max(300).optional() }).strict(),
};

/** Default data written when a block of this type is added without data. */
export const blockDefaults: Partial<Record<BlockType, Record<string, unknown>>> = {
  HERO_CAROUSEL: { source: 'FEATURED_PRODUCTS' },
  BRANDS_MARQUEE: { mode: 'ALL' },
  RICH_TEXT: { html: '' },
};

export const BLOCK_TYPES = Object.values(BlockType) as BlockType[];
