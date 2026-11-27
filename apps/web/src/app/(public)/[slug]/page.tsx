import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/api/public";
import { ApiError } from "@/lib/api/errors";
import { toMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/layout/page-header";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { RichHtml } from "@/components/content/rich-html";
import { JsonLd } from "@/components/seo-jsonld";
import { RESERVED_SLUGS } from "@/lib/constants";

type Props = { params: Promise<{ slug: string }> };

/** Generic CMS page (plan 6.11). Reserved slugs never reach this route. */
async function load(slug: string) {
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return null;
  return getPage(slug).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  return page ? toMetadata(page.seo) : { title: "Page not found" };
}

export default async function GenericPage({ params }: Props) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();
  const legal = page.template === "LEGAL";
  return (
    <>
      <PageHeader title={page.title} intro={page.heroSubtitle} crumbs={[{ label: page.title }]} />
      {page.blocks.length ? (
        <SectionRenderer blocks={page.blocks} />
      ) : (
        <section className="section-md">
          <div className={legal ? "container-prose px-4" : "container-prose px-4"}>
            <RichHtml html={(page as unknown as { bodyHtml?: string }).bodyHtml ?? ""} />
          </div>
        </section>
      )}
      <JsonLd data={page.seo.jsonLd} />
    </>
  );
}
