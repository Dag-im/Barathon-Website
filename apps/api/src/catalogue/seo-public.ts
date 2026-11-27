import { PrismaService } from '../prisma/prisma.service';
import { MediaDto } from '../media/media.dto';

export interface SeoDtoPublic {
  title: string;
  description: string | null;
  canonical: string;
  robots: string;
  openGraph: { title: string; description: string | null; type: 'website' | 'article' | 'product'; url: string; image: MediaDto | null; siteName: string; locale: string };
  twitter: { card: 'summary' | 'summary_large_image'; title: string; description: string | null; image: string | null; site: string | null };
  jsonLd: object[];
}

interface SeoRow {
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterCard: string;
  canonicalUrl: string | null;
  noindex: boolean;
  nofollow: boolean;
  jsonLd: unknown;
}

/** Builds the public SEO object with site defaults applied (backend-plan 6.2.0). */
export async function buildSeo(
  prisma: PrismaService,
  input: {
    seo: SeoRow | null;
    fallbackTitle: string;
    fallbackDescription: string | null;
    path: string;
    type: 'website' | 'article' | 'product';
    image: MediaDto | null;
    jsonLd: object[];
  },
): Promise<SeoDtoPublic> {
  const settings = await prisma.client.siteSettings.findUnique({ where: { id: 'singleton' } });
  const defaults = (settings?.seoDefaults ?? {}) as { titleTemplate?: string; defaultDescription?: string; twitterHandle?: string; siteNoindex?: boolean };
  const siteName = settings?.siteName ?? 'Barathon Trading';
  const template = defaults.titleTemplate ?? '%s | Barathon Trading';
  const title = (input.seo?.metaTitle ?? input.fallbackTitle).slice(0, 200);
  const finalTitle = input.seo?.metaTitle ? title : template.replace('%s', title);
  const description = input.seo?.metaDescription ?? input.fallbackDescription ?? defaults.defaultDescription ?? null;
  const base = (process.env.PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const canonical = input.seo?.canonicalUrl
    ? input.seo.canonicalUrl.startsWith('/')
      ? `${base}${input.seo.canonicalUrl}`
      : input.seo.canonicalUrl
    : `${base}${input.path}`;
  const noindex = !!input.seo?.noindex || !!defaults.siteNoindex;
  const nofollow = !!input.seo?.nofollow;
  const overrideLd = Array.isArray(input.seo?.jsonLd) ? (input.seo?.jsonLd as object[]) : input.seo?.jsonLd ? [input.seo.jsonLd as object] : null;
  const twitterCard = input.seo?.twitterCard === 'SUMMARY' ? 'summary' : 'summary_large_image';
  return {
    title: finalTitle,
    description,
    canonical,
    robots: `${noindex ? 'noindex' : 'index'},${nofollow ? 'nofollow' : 'follow'}`,
    openGraph: {
      title: input.seo?.ogTitle ?? title,
      description: input.seo?.ogDescription ?? description,
      type: input.type,
      url: canonical,
      image: input.image,
      siteName,
      locale: 'en_US',
    },
    twitter: {
      card: twitterCard,
      title: input.seo?.ogTitle ?? title,
      description: input.seo?.ogDescription ?? description,
      image: input.image?.url ?? null,
      site: defaults.twitterHandle ?? null,
    },
    jsonLd: overrideLd ?? input.jsonLd,
  };
}
