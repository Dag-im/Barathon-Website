import type { Metadata } from "next";
import { getPage } from "@/lib/api/public";
import { toMetadata } from "@/lib/seo/metadata";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { PageHeader } from "@/components/layout/page-header";
import { JsonLd } from "@/components/seo-jsonld";
import { breadcrumbList } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("about");
  return toMetadata(page.seo);
}

export default async function AboutPage() {
  const page = await getPage("about");
  return (
    <>
      <PageHeader eyebrow="About Us" title="About Us" intro={page.heroSubtitle} crumbs={[{ label: "About Us" }]} />
      {page.tabNav.length ? (
        <nav aria-label="On this page" className="sticky top-16 z-30 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm lg:top-20">
          <ul className="container-site flex h-14 gap-8 overflow-x-auto">
            {page.tabNav.map((t) => (
              <li key={t.anchorId} className="flex shrink-0 items-center">
                <a href={`#${t.anchorId}`} className="font-display text-[17px] font-semibold text-[#4B5563] underline-offset-[6px] hover:text-[#111827] hover:underline hover:decoration-[#2F447D] hover:decoration-2">{t.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <SectionRenderer blocks={page.blocks} />
      <JsonLd data={[...page.seo.jsonLd, breadcrumbList([{ label: "Home", href: "/" }, { label: "About Us", href: "/about" }])]} />
    </>
  );
}
