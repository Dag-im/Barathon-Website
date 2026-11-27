import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { marked } from 'marked';
import { ContactChannelType, MenuItemType, MenuLocation, SocialPlatform, BrandKind, CoreValueGroup, VideoSourceType, ContentStatus, RedirectType, RedirectMatch, EntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NavigationService } from '../navigation/navigation.service';
import { sanitizeRichText } from '../common/utils/sanitize';
import { slugify } from '../common/utils/slug';
import { parseYouTube } from '../catalogue/youtube';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { clean, country, paragraphsToHtml, TextFix, escapeHtml } from './text';

const SOURCE = process.env.SEED_SOURCE_DIR ?? resolve(__dirname, '..', '..', '..', '..', 'docs', 'source');
const REPORT_PATH = resolve(process.cwd(), 'seed-report.json');

export interface SeedReport {
  created: Record<string, number>;
  skipped: string[];
  typoFixes: TextFix[];
  staleCopyWarnings: string[];
  unmatchedCountries: string[];
  invalidYoutube: string[];
  assetFailures: Array<{ entity: string; url: string; reason: string }>;
  notes: string[];
}

const newReport = (): SeedReport => ({ created: {}, skipped: [], typoFixes: [], staleCopyWarnings: [], unmatchedCountries: [], invalidYoutube: [], assetFailures: [], notes: [] });

function bump(report: SeedReport, key: string, n = 1) {
  report.created[key] = (report.created[key] ?? 0) + n;
}

/** Source-material copy used by the home and about blocks (typos fixed by clean()). */
const STORY = [
  'BARATON Group began operating in 2007, as importer and distributor of Tata-Daewoo truck spare parts and heavy construction machinery rental in Ethiopia. Over the next 17 years, the company grew significantly, diversifying its operations to include the import and sale of a variety of products.',
  'These included FURKAWA Rock Drilling Machines from Japan, AIRMAN Air Compressors from Japan, HIFI Filtration Solutions from Switzerland, and ROBIT Rock Drilling Accessories from Finland. The company also ventured into construction sales and rental of real estate properties in the US, Kenya, and Ethiopia.',
  'In 2019, BARATON Group expanded further by setting up a USA-based subsidiary, BARATON Trade LLC, and a woodworking factory. This marked the transition to the BARATON Group.',
  'Since its formation, the BARATON Group has strengthened its customer services and broadened its resource access in key hub countries. Today, the group provides a wide array of services, including rock drilling, compressed air systems, filtration, construction machinery attachments, and real estate.',
];

const CEO = [
  'Since our company’s founding in 2007, we have been committed to fostering a prosperous society in Ethiopia by delivering efficient, user-friendly products to customers in the construction and mining industries. Our solutions play a vital role in the development of social infrastructure.',
  'We will continue to build on the strong foundation we have established, striving for leadership in our industry. By exploring new marketing opportunities and innovative ideas, we aim to provide original products and services that meet evolving needs. Our commitment extends to creating a sustainable society by working collaboratively with our suppliers and end users.',
];

const MISSION = [
  'Committed to excellence by leveraging our competitive advantages in every field we operate.',
  'Upholding the highest standards of business ethics and organizational values.',
  'Delivering customer satisfaction through exceptional products and services.',
  'Cultivating a culture of trust, openness, and mutual respect, making our workplace both stimulating and rewarding.',
];

const VISION =
  'To be a regional leader in our industry, driven by sustainable growth, knowledge, excellence, and best practices. As we face the challenges ahead, we will stay agile, adapting to the evolving world while remaining a trusted partner for the companies that rely on us. Together, we shape the future!';

/** Mapping of source product titles to brand, category and origin (backend-plan 3.13.1). */
const PRODUCT_MAP: Record<string, { brand: string; category: string }> = {
  'FURUKAWA Rock Drills': { brand: 'Furukawa Rock Drill Co., Ltd.', category: 'Rock Drills' },
  'Air Compressor': { brand: 'AIRMAN', category: 'Air Compressors' },
  Montabert: { brand: 'Montabert', category: 'Hydraulic Drilling Attachments' },
  Monark: { brand: 'Monark', category: 'Drilling Accessories' },
  Carmix: { brand: 'Carmix', category: 'Concrete Equipment' },
  Elsasser: { brand: 'Elsasser', category: 'Filtration' },
  Walter: { brand: 'Walter Gerätebau', category: 'Industrial Cleaning' },
  'Nakayama crushers': { brand: 'Nakayama', category: 'Crushing & Screening' },
};

const CATEGORIES = ['Rock Drills', 'Air Compressors', 'Hydraulic Drilling Attachments', 'Drilling Accessories', 'Concrete Equipment', 'Filtration', 'Industrial Cleaning', 'Crushing & Screening'];

/** Brand names after cleanup, keyed by the legacy Mongo id; kind per backend-plan 3.13.1. */
const BRAND_SORT = ['67e8f5735d8bb94eec4cdf2e', '67e8f5735d8bb94eec4cdf2f', '682a0b70ebc88a27eac5a3a6', '6828cb84ebc88a27eac5a2c3', '68273aa7ebc88a27eac5a1f9', '682a093aebc88a27eac5a396', '6828a7e0ebc88a27eac5a277', '6866465bebc88a27eac5b054', '686622f0ebc88a27eac5aff0'];
const PRINCIPAL = new Set(['67e8f5735d8bb94eec4cdf2e', '67e8f5735d8bb94eec4cdf2f']);

const SIX_YOUTUBE_IDS = ['AJSPVh_fCoY', 'C8uXNLChKuo', 'gnwQx7AC2ws', 'pyoNPfUgJJo', 'q9M_eFAnwPs', 'uQlNhObyLu8'];

export async function seedAll(prisma: PrismaService, settings: SettingsService, nav: NavigationService, password: PasswordService, audit: AuditService, opts: { adminEmail?: string; adminName?: string; adminPassword?: string; report?: SeedReport }) {
  const db = prisma.client;
  const report = opts.report ?? newReport();
  const fixes = report.typoFixes;
  const products = JSON.parse(readFileSync(join(SOURCE, 'product.json'), 'utf8')) as any[];
  const companies = JSON.parse(readFileSync(join(SOURCE, 'company.json'), 'utf8')) as any[];
  const services = JSON.parse(readFileSync(join(SOURCE, 'service.json'), 'utf8')) as any[];

  // --- site settings, navigation, contact info -------------------------------------
  await settings.row();
  bump(report, 'siteSettings', 0);
  await nav.ensureMenus();

  if (!(await db.contactChannel.count())) {
    const phones = [
      ['+251911514558', '+251 911 514558'],
      ['+251911175644', '+251 911 175644'],
      ['+251114709133', '+251 114 709133'],
    ];
    for (const [i, [value, display]] of phones.entries()) {
      await db.contactChannel.create({ data: { type: ContactChannelType.PHONE, label: i === 0 ? 'Main line' : null, value, displayValue: display, isPrimary: i === 0, showInFooter: true, showOnContactPage: true, sortOrder: i, visible: true } });
    }
    await db.contactChannel.create({ data: { type: ContactChannelType.EMAIL, label: 'Email', value: 'aboma.taye@gmail.com', displayValue: 'aboma.taye@gmail.com', showInFooter: true, showOnContactPage: true, sortOrder: 3, visible: true } });
    bump(report, 'contactChannels', 4);
  }

  if (!(await db.socialLink.count())) {
    for (const [i, platform] of [SocialPlatform.FACEBOOK, SocialPlatform.X, SocialPlatform.LINKEDIN, SocialPlatform.INSTAGRAM].entries()) {
      await db.socialLink.create({ data: { platform, url: null, visible: false, sortOrder: i } });
    }
    bump(report, 'socialLinks', 4);
    report.notes.push('Social links are seeded hidden with no URL until the admin supplies them.');
  }

  // --- product categories ------------------------------------------------------------
  const categoryIds = new Map<string, string>();
  for (const [i, name] of CATEGORIES.entries()) {
    const slug = slugify(name);
    const row = await db.productCategory.upsert({ where: { slug }, create: { name, slug, sortOrder: i, status: ContentStatus.PUBLISHED, publishedAt: new Date() }, update: {} });
    categoryIds.set(name, row.id);
  }
  bump(report, 'productCategories', CATEGORIES.length);

  // --- brands (companies) ------------------------------------------------------------
  const brandIds = new Map<string, string>();
  const brandNames: Record<string, string> = {};
  for (const c of companies) {
    const rawName = c.company_name as string;
    const name = clean(rawName, `brand:${c._id}:name`, fixes)
      .replace('Sumitomo construction machinery CO.LTD', 'Sumitomo Construction Machinery Co., Ltd.')
      .replace('Furukawa Rock Drill Co', 'Furukawa Rock Drill Co., Ltd.');
    if (name !== rawName) fixes.push({ where: `brand:${c._id}:name`, before: rawName, after: name });
    brandNames[c._id] = name;
    const c2 = country(c.company_country);
    if (c2.unmatched) report.unmatchedCountries.push(`brand ${name}: ${c.company_country}`);
    const sortIdx = BRAND_SORT.indexOf(c._id);
    const short = clean(c.company_short_discription, `brand:${c._id}:short`, fixes);
    const desc = paragraphsToHtml(clean(c.company_description, `brand:${c._id}:description`, fixes));
    const slug = slugify(name);
    const existing = await db.brand.findFirst({ where: { legacyId: c._id } });
    const row =
      existing ??
      (await db.brand.create({
        data: {
          name,
          slug,
          legacyId: c._id,
          kind: PRINCIPAL.has(c._id) ? BrandKind.PRINCIPAL : BrandKind.PARTNER,
          shortDescription: short.slice(0, 600),
          descriptionHtml: sanitizeRichText(desc),
          countryCode: c2.code,
          countryName: c2.name,
          city: c2.city,
          isFeatured: PRINCIPAL.has(c._id),
          showInMarquee: true,
          sortOrder: sortIdx < 0 ? 99 : sortIdx,
          status: ContentStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      }));
    if (!existing) bump(report, 'brands');
    brandIds.set(c._id, row.id);
    // Brand video from the old free-text YouTube field (replaces it as a YOUTUBE video).
    const parsed = parseYouTube(String(c.company_youtubeLink ?? ''));
    if (!parsed) {
      report.invalidYoutube.push(`${name}: "${c.company_youtubeLink}"`);
    } else if (!(await db.video.findFirst({ where: { brandId: row.id, sourceType: VideoSourceType.YOUTUBE } }))) {
      await db.video.create({
        data: {
          title: `${name} overview`,
          sourceType: VideoSourceType.YOUTUBE,
          youtubeId: parsed.youtubeId,
          startSeconds: parsed.startSeconds,
          sourceUrl: parsed.sourceUrl,
          brandId: row.id,
          isFeatured: true,
          sortOrder: sortIdx < 0 ? 99 : sortIdx,
          status: ContentStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });
      bump(report, 'videos');
    }
  }
  report.notes.push('Walter Gerätebau has no usable video link (source value "a") and is skipped.');

  // Six YouTube ids named in the content brief: standalone videos for those not already linked to a brand.
  const linked = new Set((await db.video.findMany({ where: { sourceType: VideoSourceType.YOUTUBE } })).map((v) => v.youtubeId));
  for (const [i, id] of SIX_YOUTUBE_IDS.entries()) {
    if (linked.has(id)) continue;
    await db.video.create({
      data: {
        title: `Featured video ${i + 1}`,
        description: null,
        sourceType: VideoSourceType.YOUTUBE,
        youtubeId: id,
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
        isFeatured: true,
        sortOrder: 50 + i,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    bump(report, 'videos');
    report.notes.push(`YouTube id ${id} is not found in docs/source; seeded as "Featured video ${i + 1}" for the admin to retitle.`);
  }

  // --- products ----------------------------------------------------------------------
  for (const [i, p] of products.entries()) {
    const title = clean(p.title, `product:${p._id}:title`, fixes);
    const map = PRODUCT_MAP[p.title];
    const c2 = country(p.country);
    if (c2.unmatched) report.unmatchedCountries.push(`product ${title}: ${p.country}`);
    const short = clean(p.shortDescription, `product:${p._id}:short`, fixes);
    let md = clean(p.content, `product:${p._id}:content`, fixes);
    // Strip a leading H1 equal to the title; the page already shows it.
    md = md.replace(new RegExp(`^#\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n`), '');
    const html = sanitizeRichText(marked.parse(md, { async: false }) as string);
    const slug = slugify(title);
    if (await db.product.findFirst({ where: { legacyId: p._id } })) {
      report.skipped.push(`product:${title}`);
      continue;
    }
    await db.product.create({
      data: {
        title: title.slice(0, 160),
        slug,
        legacyId: p._id,
        shortDescription: short.slice(0, 600),
        contentHtml: html,
        brandId: map ? brandIds.get(findBrandLegacy(companies, map.brand)) ?? null : null,
        categoryId: map ? categoryIds.get(map.category) ?? null : null,
        countryCode: c2.code,
        countryName: c2.name,
        originCity: c2.city,
        isFeatured: i < 8,
        sortOrder: i,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(p.createdAt ?? Date.now()),
      },
    });
    bump(report, 'products');
    await db.seoMeta.upsert({
      where: { entityType_entityId: { entityType: EntityType.PRODUCT, entityId: (await db.product.findFirstOrThrow({ where: { legacyId: p._id } })).id } },
      create: { entityType: EntityType.PRODUCT, entityId: (await db.product.findFirstOrThrow({ where: { legacyId: p._id } })).id, metaDescription: short.slice(0, 160) },
      update: {},
    });
  }

  // --- services ----------------------------------------------------------------------
  for (const [i, s] of services.entries()) {
    const title = clean(s.title, `service:${s._id}:title`, fixes);
    if (await db.service.findFirst({ where: { legacyId: s._id } })) {
      report.skipped.push(`service:${title}`);
      continue;
    }
    const svc = await db.service.create({
      data: {
        title,
        slug: slugify(title),
        legacyId: s._id,
        shortDescription: clean(s.shortDescription, `service:${s._id}:short`, fixes),
        sortOrder: i,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    for (const [n, line] of (s.contentList as string[]).entries()) {
      const text = clean(line, `service:${s._id}:feature`, fixes);
      const [head, ...rest] = text.split(/\s[–-]\s/);
      await db.serviceFeature.create({ data: { serviceId: svc.id, title: head.slice(0, 200), description: rest.length ? rest.join(' - ').slice(0, 500) : null, sortOrder: n } });
    }
    bump(report, 'services');
  }

  // --- subsidiaries ------------------------------------------------------------------
  const furukawa = brandIds.get('67e8f5735d8bb94eec4cdf2e');
  const airman = brandIds.get('67e8f5735d8bb94eec4cdf2f');
  if (!(await db.subsidiary.findFirst({ where: { slug: 'baraton-trade-llc' } }))) {
    const llc = await db.subsidiary.create({
      data: {
        name: 'Baraton Trade LLC',
        slug: 'baraton-trade-llc',
        kind: 'LLC',
        countryCode: 'US',
        regionNote: 'Florida, USA',
        tagline: 'Global product distribution',
        introHtml: `<p>${escapeHtml('A subsidiary of Baraton Group, Baraton Trade LLC operates globally, offering innovative and reliable product solutions. Licensed in Florida, USA, the company prioritizes exceptional customer service and strong relationships.')}</p>`,
        bodyHtml: `<p>${escapeHtml('With a focus on quality and integrity, Baraton Trade LLC ensures clients receive top-notch support while driving industry advancements through continuous innovation.')}</p>`,
        lists: [
          { title: 'Focus areas', style: 'CHECKS', items: ['Technological Solutions', 'Real Estate Development & Portfolio Management', 'Stock & Share Portfolio Management', 'Global Product Distribution'] },
          { title: 'Our brands are recognized for their exceptional performance, cost efficiency, quality, and safety standards. Baraton Group provides comprehensive solutions for:', style: 'BULLETS', items: ['Construction machinery', 'Rock drilling tools', 'Hydraulic attachments', 'Equipment servicing & support'] },
          { title: 'Exclusive sales and marketing rights', style: 'CHECKS', items: ['Furukawa Rock Drill Co. Ltd – Japan, Ethiopia', 'Airman Industries Ltd – Japan, Ethiopia'] },
          { title: 'Portfolio', style: 'CHIPS', items: ['Real Estate Portfolio', 'Stock & Share Management'] },
        ],
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        sortOrder: 0,
      },
    });
    for (const id of [furukawa, airman].filter(Boolean) as string[]) await db.subsidiaryBrand.create({ data: { subsidiaryId: llc.id, brandId: id, relation: 'EXCLUSIVE_RIGHTS' } });
    const plc = await db.subsidiary.create({
      data: {
        name: 'Baraton Trade PLC',
        slug: 'baraton-trade-plc',
        kind: 'PLC',
        countryCode: 'ET',
        regionNote: 'Ethiopia',
        tagline: 'Official agent in Ethiopia',
        introHtml: `<p>${escapeHtml('A proud subsidiary of Baraton Group, Baraton Trade PLC is the official agent of Furukawa Rock Drills Co., Ltd and Airman Corporation Ltd in Ethiopia.')}</p>`,
        bodyHtml: paragraphsToHtml(
          [
            'With the expertise of our consultants and certified engineers, we provide industry-leading solutions tailored to be efficient, reliable, and cost-effective.',
            'Our authentic, high-quality parts are built to support the way you work – giving you 100% confidence in performance and durability.',
            'We recognize that fast access to the right parts, service, and support is critical to keeping your machines operating at peak performance, ensuring maximum productivity for your business.',
            'Baraton Trade PLC delivers cutting-edge technology to help you stay connected on the job site—reducing downtime while maximizing productivity and profitability.',
          ].join('\n\n'),
        ),
        lists: [{ title: "We provide everything you need to keep your machines and attachments in top condition. Whether you're looking for:", style: 'CHECKS', items: ['Genuine replacement parts', 'Technical support', 'Self-repair resources'] }],
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        sortOrder: 1,
      },
    });
    for (const id of [furukawa, airman].filter(Boolean) as string[]) await db.subsidiaryBrand.create({ data: { subsidiaryId: plc.id, brandId: id, relation: 'OFFICIAL_AGENT' } });
    bump(report, 'subsidiaries', 2);

    // Head office and the hidden LLC office placeholder.
    if (!(await db.office.count())) {
      await db.office.create({ data: { name: 'Head Office', isPrimary: true, addressLine1: 'Bole Road, Wollo Sefer', poBox: '62716', city: 'Addis Ababa', countryCode: 'ET', countryName: 'Ethiopia', visible: true, sortOrder: 0 } });
      await db.office.create({ data: { name: 'Baraton Trade LLC', addressLine1: 'Address to be added', city: 'Florida', countryCode: 'US', countryName: 'United States', visible: false, sortOrder: 1, subsidiaryId: llc.id } });
      bump(report, 'offices', 2);
    }
  }

  // --- leader message, core values, timeline ----------------------------------------
  if (!(await db.leaderMessage.count())) {
    await db.leaderMessage.create({ data: { heading: "CEO's Message", messageHtml: CEO.map((p) => `<p>${escapeHtml(p)}</p>`).join(''), isPrimary: true, status: ContentStatus.PUBLISHED } });
    bump(report, 'leaderMessages');
    report.notes.push('CEO name and photo are not in the source; left empty for the admin.');
  }
  if (!(await db.coreValue.count())) {
    for (const [i, t] of MISSION.entries()) await db.coreValue.create({ data: { group: CoreValueGroup.MISSION, title: t, sortOrder: i, status: ContentStatus.PUBLISHED } });
    for (const [i, t] of ['Excellence', 'Integrity and business ethics', 'Customer satisfaction', 'Trust, openness and respect'].entries()) {
      await db.coreValue.create({ data: { group: CoreValueGroup.VALUE, title: t, sortOrder: i, status: ContentStatus.DRAFT } });
      report.notes.push(`Core value "${t}" is derived, seeded as DRAFT.`);
    }
    bump(report, 'coreValues', 8);
  }
  if (!(await db.timelineEntry.count())) {
    const entries = [
      ['2007', 2007, 'Founded', 'Tata-Daewoo truck spare parts import and distribution, heavy construction machinery rental in Ethiopia.'],
      ['2007 - 2024', 2007, 'Diversification', 'FURUKAWA rock drilling machines (Japan), AIRMAN air compressors (Japan), HIFI filtration (Switzerland), ROBIT rock drilling accessories (Finland); real estate construction, sales and rental in the US, Kenya, Ethiopia.'],
      ['2019', 2019, 'USA subsidiary and transition', 'USA subsidiary BARATON Trade LLC and a woodworking factory; transition to BARATON Group.'],
      ['Today', null, 'Today', 'Rock drilling, compressed air systems, filtration, construction machinery attachments and real estate services.'],
    ] as const;
    for (const [i, [label, year, title, desc]] of entries.entries()) {
      await db.timelineEntry.create({ data: { yearLabel: label, startYear: year, title: clean(title, 'timeline', fixes), description: clean(desc, 'timeline', fixes), sortOrder: i } });
    }
    bump(report, 'timelineEntries', 4);
  }

  // --- pages ---------------------------------------------------------------------------
  const logo = await db.media.findFirst({ where: { originalName: 'logo.png' } });
  if (!(await db.page.findFirst({ where: { key: 'home' } }))) {
    await db.page.create({
      data: {
        key: 'home',
        slug: 'home',
        title: 'Home',
        isSystem: true,
        template: 'HOME',
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        showInSitemap: true,
        blocks: {
          create: [
            { type: 'HERO_CAROUSEL', sortOrder: 0, data: { source: 'FEATURED_PRODUCTS', autoplayMs: 6000, showThumbnails: true, showCounter: true, limit: 8 } },
            { type: 'BRANDS_MARQUEE', sortOrder: 1, data: { title: 'Brands We Work With', subtitle: 'Trusted by industry leaders worldwide', mode: 'ALL', linkToBrand: true } },
            {
              type: 'IMAGE_TEXT',
              sortOrder: 2,
              data: {
                imageMediaId: logo?.id ?? null,
                imagePosition: 'LEFT',
                heading: 'BARATON Group',
                bodyHtml: STORY.map((p) => `<p>${escapeHtml(clean(p, 'home:story', fixes))}</p>`).join(''),
                buttons: [
                  { label: 'Learn more', href: '/about', variant: 'PRIMARY', target: 'SELF' },
                  { label: 'Our Products', href: '/products', variant: 'SECONDARY', target: 'SELF' },
                ],
                background: 'DARK',
              },
            },
            { type: 'VIDEOS_GRID', sortOrder: 3, data: { title: 'Featured Videos', subtitle: 'Discover our work through these immersive experiences', mode: 'FEATURED', limit: 6 } },
            { type: 'SERVICES_GRID', sortOrder: 4, data: { title: 'Our Services', mode: 'ALL', ctaLabel: 'Read More', ctaHref: '/services' } },
          ],
        },
      },
    });
    bump(report, 'pages');
  }
  if (!(await db.page.findFirst({ where: { key: 'about' } }))) {
    await db.page.create({
      data: {
        key: 'about',
        slug: 'about',
        title: 'About Us',
        isSystem: true,
        template: 'ABOUT',
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        blocks: {
          create: [
            { type: 'LEADER_MESSAGE', sortOrder: 0, anchorId: 'ceo-message', navLabel: 'CEO Message', showInTabNav: true, data: { leaderMessageId: null } },
            { type: 'TIMELINE', sortOrder: 1, anchorId: 'history', navLabel: 'Our History', showInTabNav: false, data: { mode: 'ALL' } },
            { type: 'MISSION_VISION', sortOrder: 2, anchorId: 'philosophy', navLabel: 'Philosophy', showInTabNav: true, data: { missionTitle: 'Mission', visionTitle: 'Vision', visionHtml: `<p>${escapeHtml(VISION)}</p>`, missionMode: 'ALL' } },
            { type: 'SUBSIDIARIES', sortOrder: 3, data: { mode: 'ALL', layout: 'TABS' } },
          ],
        },
      },
    });
    bump(report, 'pages');
  }
  for (const [slug, title] of [['privacy-policy', 'Privacy Policy'], ['terms-of-service', 'Terms of Service']] as const) {
    if (await db.page.findFirst({ where: { slug } })) continue;
    await db.page.create({
      data: {
        slug,
        title,
        status: ContentStatus.DRAFT,
        blocks: { create: [{ type: 'RICH_TEXT', sortOrder: 0, data: { html: '<p>Placeholder text. Replace with the approved wording before publishing.</p>' } }] },
      },
    });
    bump(report, 'pages');
  }

  // --- navigation ---------------------------------------------------------------------
  const menuEmpty = async (loc: MenuLocation) => (await db.menuItem.count({ where: { menu: { location: loc } } })) === 0;
  const homePage = await db.page.findFirst({ where: { key: 'home' } });
  const aboutPage = await db.page.findFirst({ where: { key: 'about' } });
  if (await menuEmpty(MenuLocation.HEADER)) {
    await nav.replace(MenuLocation.HEADER, [
      { type: MenuItemType.PAGE, label: 'Home', pageId: homePage?.id ?? null },
      { type: MenuItemType.PAGE, label: 'About Us', pageId: aboutPage?.id ?? null },
      { type: MenuItemType.DYNAMIC_PRODUCTS, label: 'Products', config: { limit: 12, viewAllLabel: 'All products', showViewAll: true }, href: '/products' },
      { type: MenuItemType.CUSTOM, label: 'Service', href: '/services' },
      { type: MenuItemType.CUSTOM, label: 'Contact Us', href: '/contact' },
    ]);
  }
  if (await menuEmpty(MenuLocation.FOOTER_QUICK)) {
    await nav.replace(MenuLocation.FOOTER_QUICK, [
      { type: MenuItemType.PAGE, label: 'About Us', pageId: aboutPage?.id ?? null },
      { type: MenuItemType.CUSTOM, label: 'Our Products', href: '/products' },
      { type: MenuItemType.CUSTOM, label: 'Our Services', href: '/services' },
      { type: MenuItemType.CUSTOM, label: 'Contact Us', href: '/contact' },
    ]);
  }
  if (await menuEmpty(MenuLocation.FOOTER_PRODUCTS)) {
    await nav.replace(MenuLocation.FOOTER_PRODUCTS, [{ type: MenuItemType.DYNAMIC_PRODUCTS, label: 'Our Products', config: { limit: 5, showViewAll: false } }]);
  }

  // --- legacy redirects ------------------------------------------------------------------
  const redirectRows: Array<{ sourcePath: string; targetPath: string }> = [
    { sourcePath: '/service', targetPath: '/services' },
    { sourcePath: '/product', targetPath: '/products' },
    { sourcePath: '/home', targetPath: '/' },
    { sourcePath: '/about-us', targetPath: '/about' },
    { sourcePath: '/contact-us', targetPath: '/contact' },
  ];
  for (const p of await db.product.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true, slug: true } })) {
    redirectRows.push({ sourcePath: `/product/${p.legacyId}`, targetPath: `/products/${p.slug}` });
  }
  for (const b of await db.brand.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true, slug: true } })) {
    redirectRows.push({ sourcePath: `/company/${b.legacyId}`, targetPath: `/brands/${b.slug}` });
  }
  for (const r of redirectRows) {
    await db.redirect.upsert({
      where: { sourcePath_matchType: { sourcePath: r.sourcePath, matchType: RedirectMatch.EXACT } },
      create: { sourcePath: r.sourcePath, targetPath: r.targetPath, type: RedirectType.MOVED_301, matchType: RedirectMatch.EXACT, note: 'Legacy site redirect' },
      update: {},
    });
  }
  bump(report, 'redirects', redirectRows.length);

  // --- admin bootstrap ------------------------------------------------------------------
  if (opts.adminEmail && opts.adminPassword && !(await db.user.count())) {
    const hash = await password.hash(opts.adminPassword);
    await db.user.create({ data: { email: opts.adminEmail.toLowerCase(), name: opts.adminName ?? 'Administrator', passwordHash: hash, mustChangePassword: true } });
    await audit.record({ action: 'CREATE', summary: `Bootstrap administrator ${opts.adminEmail} created by seed`, entityType: 'User', actorEmail: 'CLI' });
    bump(report, 'users');
  }

  report.notes.push('Re-running the seed only inserts missing rows; edited rows are never overwritten.');
  return report;
}

function findBrandLegacy(companies: any[], displayName: string): string {
  const match = companies.find((c) => {
    const n = String(c.company_name);
    return n === displayName || (displayName.startsWith('Walter') && /Walter/.test(n)) || (displayName.startsWith('Furukawa') && /Furukawa/.test(n)) || (displayName === 'Nakayama' && n === 'Nakayama') || (displayName === 'Montabert' && n === 'Montabert');
  });
  return match?._id ?? '';
}

export function writeReport(report: SeedReport): string {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  return REPORT_PATH;
}

export function newSeedReport(): SeedReport {
  return newReport();
}

