import { env } from "@/lib/env";

/** Absolute URL on the canonical origin. */
export const absoluteUrl = (path: string) => `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

/** Breadcrumb helper for JSON-LD and visible breadcrumbs. */
export type Crumb = { label: string; href?: string };
