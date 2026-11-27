import type { Metadata } from "next";
import { getPage } from "@/lib/api/public";
import { toMetadata } from "@/lib/seo/metadata";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { JsonLd } from "@/components/seo-jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  return toMetadata(page.seo);
}

export default async function HomePage() {
  const page = await getPage("home");
  const hasHero = page.blocks.some((b) => b.type === "HERO_CAROUSEL");
  return (
    <>
      {hasHero ? null : <h1 className="sr-only">{page.heroTitle ?? page.title}</h1>}
      <SectionRenderer blocks={page.blocks} headline={page.heroTitle ?? page.title} subheadline={page.heroSubtitle} />
      <JsonLd data={page.seo.jsonLd} />
    </>
  );
}
