import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour such as #2F3E7E');
const https = z.string().url().regex(/^https:\/\//);

/** Every group body is the flat object of its fields (backend-plan 6.3.6). */
export const groupSchemas = {
  branding: z
    .object({
      siteName: z.string().trim().min(1).max(120),
      legalName: z.string().max(200).nullable(),
      tagline: z.string().max(200).nullable(),
      logoLightMediaId: z.string().uuid().nullable(),
      logoDarkMediaId: z.string().uuid().nullable(),
      faviconMediaId: z.string().uuid().nullable(),
      appleTouchIconMediaId: z.string().uuid().nullable(),
      defaultOgImageMediaId: z.string().uuid().nullable(),
      brandColors: z.object({ primary: hex, accent: hex, themeColor: hex }).strict(),
    })
    .partial()
    .strict(),
  header: z
    .object({
      headerCta: z.object({ enabled: z.boolean(), label: z.string().min(1).max(60), hrefType: z.enum(['PATH', 'TEL', 'MAILTO', 'URL']), href: z.string().max(500), icon: z.enum(['phone', 'arrow', 'none']) }).strict(),
      search: z.object({ enabled: z.boolean(), placeholder: z.string().max(80) }).strict(),
    })
    .partial()
    .strict(),
  footer: z
    .object({
      footerBlurb: z.string().max(1000).nullable(),
      copyrightText: z.string().min(1).max(300),
      footerCredit: z.object({ enabled: z.boolean(), prefix: z.string().max(40), name: z.string().max(80), url: https.nullable() }).strict(),
    })
    .partial()
    .strict(),
  seo: z.object({ seoDefaults: z.object({ titleTemplate: z.string().max(120), defaultTitle: z.string().max(200), defaultDescription: z.string().max(400).nullable(), twitterHandle: z.string().max(40).nullable(), siteNoindex: z.boolean() }).strict() }).partial().strict(),
  analytics: z.object({ ga4Id: z.string().max(40).nullable(), gtmId: z.string().max(40).nullable(), searchConsoleVerification: z.string().max(200).nullable() }).partial().strict(),
  maintenance: z.object({ enabled: z.boolean(), message: z.string().max(300).nullable() }).partial().strict(),
  announcement: z
    .object({
      enabled: z.boolean(),
      text: z.string().max(300),
      linkLabel: z.string().max(60).nullable(),
      href: z.string().max(500).nullable(),
      variant: z.enum(['INFO', 'WARNING', 'PROMO']),
      startsAt: z.string().datetime().nullable(),
      endsAt: z.string().datetime().nullable(),
    })
    .partial()
    .strict(),
  'contact-form': z
    .object({ consentRequired: z.boolean(), consentText: z.string().max(500).nullable(), successMessage: z.string().max(300), captchaProvider: z.enum(['NONE', 'TURNSTILE', 'HCAPTCHA']) })
    .partial()
    .strict(),
  robots: z.object({ extraRules: z.string().max(2000), disallow: z.array(z.string().max(200)).max(50) }).partial().strict(),
  sitemap: z
    .object({
      excludeTypes: z.array(z.string()).max(20),
      defaults: z.object({ changefreq: z.string(), priority: z.number().min(0).max(1) }).strict(),
      perType: z.record(z.object({ changefreq: z.string(), priority: z.number().min(0).max(1) }).strict()),
    })
    .partial()
    .strict(),
} as const;

export type GroupName = keyof typeof groupSchemas;
export const GROUP_NAMES = Object.keys(groupSchemas) as GroupName[];

/** Converts a validated group body into the Prisma columns it owns. */
export function groupToColumns(group: GroupName, body: Record<string, unknown>): Record<string, unknown> {
  switch (group) {
    case 'analytics':
      return { analytics: body };
    case 'maintenance':
      return { maintenance: body };
    case 'announcement':
      return { announcement: body };
    case 'contact-form':
      return { contactForm: body };
    case 'robots':
      return { robots: body };
    case 'sitemap':
      return { sitemap: body };
    default:
      return body;
  }
}
