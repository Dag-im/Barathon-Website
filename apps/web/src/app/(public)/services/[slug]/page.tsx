import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getService } from "@/lib/api/public";
import { ApiError } from "@/lib/api/errors";
import { toMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CmsImage } from "@/components/media/cms-image";
import { RichHtml } from "@/components/content/rich-html";
import { ProductCard } from "@/components/products/product-card";
import { BrandCard } from "@/components/brands/brand-card";
import { Section } from "@/components/sections/section";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo-jsonld";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getService(slug).catch(() => null);
  return s ? toMetadata(s.seo) : { title: "Service not found" };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const s = await getService(slug).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!s) notFound();
  return (
    <>
      <section className="section-navy bg-[#111827] text-white">
        <Breadcrumbs items={[{ label: "Services", href: "/services" }, { label: s.title }]} />
        <div className="container-site grid gap-12 py-16 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="eyebrow text-white"><span>Service</span></p>
            <h1 className="t-h1 mt-4 text-white">{s.title}</h1>
            <p className="t-lead mt-5 text-[#D1D5DB]">{s.shortDescription}</p>
            {s.ctaHref ? <Button asChild variant="primary" size="lg" className="mt-8 bg-white text-[#111827] hover:bg-[#EEF1F8]"><Link href={s.ctaHref}>{s.ctaLabel ?? "Request this service"}</Link></Button> : null}
          </div>
          <div className="relative aspect-[16/10] lg:col-span-5">
            <div className="plate absolute inset-0 bg-[#1F2937]" />
            <div className="relative size-full overflow-hidden"><CmsImage media={s.image} sizes="(min-width:1024px) 40vw, 100vw" caption={s.title} /></div>
          </div>
        </div>
      </section>
      {s.features.length ? (
        <Section id="included" title="What is included" tone="white">
          <ol className="grid gap-x-12 md:grid-cols-2">
            {s.features.map((f, i) => (
              <li key={f.title} className="grid grid-cols-[56px_1fr] gap-4 border-b border-[#E5E7EB] py-6">
                <span className="font-display text-2xl font-semibold text-[#2F447D]">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-xl font-semibold">{f.title}</h3>
                  {f.description ? <p className="mt-1 text-[#374151]">{f.description}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
      {s.bodyHtml ? <Section id="service-body" tone="light" size="md"><div className="container-prose px-0"><RichHtml html={s.bodyHtml} /></div></Section> : null}
      {s.relatedBrands.length ? (
        <Section id="related-brands" title="Brands" tone="light" size="md">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{s.relatedBrands.map((b) => <li key={b.id}><BrandCard brand={b} /></li>)}</ul>
        </Section>
      ) : null}
      {s.relatedProducts.length ? (
        <Section id="related-products" title="Related products" tone="white" size="md">
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{s.relatedProducts.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ul>
        </Section>
      ) : null}
      <Section id="service-cta" tone="navy" size="md">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="t-h3 text-white">Talk to our service team about {s.title.toLowerCase()}.</p>
          <Button asChild variant="primary" className="bg-white text-[#111827] hover:bg-[#EEF1F8]"><Link href={`/contact?service=${s.slug}&subject=service`}>Request this service</Link></Button>
        </div>
      </Section>
      <JsonLd data={s.seo.jsonLd} />
    </>
  );
}
