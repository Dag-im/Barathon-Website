import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/api/public";
import { ApiError } from "@/lib/api/errors";
import { toMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CmsImage } from "@/components/media/cms-image";
import { VideoPlayer } from "@/components/media/video-player";
import { RichHtml } from "@/components/content/rich-html";
import { ProductCard } from "@/components/products/product-card";
import { Section } from "@/components/sections/section";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo-jsonld";
import { videoObject } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/seo/urls";
import { Check, ArrowUpRight } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBrand(slug).catch(() => null);
  return b ? toMetadata(b.seo) : { title: "Brand not found" };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const b = await getBrand(slug).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!b) notFound();
  const videoNodes = b.videos.map((v) => videoObject(v, absoluteUrl(`/brands/${b.slug}`))).filter(Boolean) as Record<string, unknown>[];
  return (
    <>
      <Breadcrumbs items={[{ label: "Brands", href: "/brands" }, { label: b.name }]} />
      <section className="border-b border-[#D1D5DB] bg-white">
        <div className="container-site grid gap-10 py-14 lg:grid-cols-12">
          <div className="relative aspect-[3/2] border border-[#E5E7EB] bg-white p-8 lg:col-span-3">
            <CmsImage media={b.logo} sizes="(min-width:1024px) 25vw, 60vw" fit="contain" variant="logo" caption={b.name} />
          </div>
          <div className="lg:col-span-6">
            <div className="flex flex-wrap gap-2">
              {b.country.name ? <span className="inline-flex items-center gap-2 border border-[#D1D5DB] px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-[#374151]"><span aria-hidden className="h-3 w-[3px] bg-[#843C40]" />{b.country.name}</span> : null}
              {b.isExclusiveAgent ? <span className="inline-flex items-center gap-1 bg-[#2F447D] px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-white"><Check aria-hidden className="size-3" />Official agent</span> : null}
            </div>
            <h1 className="t-h1 mt-5 text-foreground">{b.name}</h1>
            <p className="t-lead mt-4 text-[#374151]">{b.shortDescription}</p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-3">
            <Button asChild variant="primary" size="lg"><Link href={`/contact?subject=partnership&brand=${b.slug}`}>Contact us about {b.name}</Link></Button>
            {b.websiteUrl ? <a href={b.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#0D5380] underline underline-offset-[3px]">Visit {b.name} website<ArrowUpRight aria-hidden className="size-4" /></a> : null}
          </div>
        </div>
      </section>
      <Section id="about-brand" title={undefined} size="lg" tone="light">
        <div className="grid gap-12 lg:grid-cols-12">
          <RichHtml html={b.descriptionHtml} className="lg:col-span-8" />
        </div>
      </Section>
      {b.videos.length ? (
        <Section id="brand-video" title={`${b.name} in action`} tone="navy">
          <div className="mx-auto max-w-[960px] space-y-6">{b.videos.map((v) => <VideoPlayer key={v.id} video={v} />)}</div>
        </Section>
      ) : null}
      {b.products.length ? (
        <Section id="brand-products" title={`Products from ${b.name}`} tone="light">
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{b.products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ul>
        </Section>
      ) : null}
      <JsonLd data={[...b.seo.jsonLd, ...videoNodes]} />
    </>
  );
}
