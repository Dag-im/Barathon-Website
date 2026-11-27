import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/api/public";
import { ApiError } from "@/lib/api/errors";
import { toMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CmsImage } from "@/components/media/cms-image";
import { VideoPlayer } from "@/components/media/video-player";
import { RichHtml } from "@/components/content/rich-html";
import { SpecTable } from "@/components/content/spec-table";
import { ShareButton } from "@/components/content/share-button";
import { ProductCard } from "@/components/products/product-card";
import { Section } from "@/components/sections/section";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo-jsonld";
import { videoObject } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/seo/urls";
import { Phone, MessageCircle } from "lucide-react";
import { ProductTocNav } from "@/components/products/product-toc";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug).catch(() => null);
  return p ? toMetadata(p.seo) : { title: "Product not found" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProduct(slug).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!p) notFound();
  const crumbs = [
    { label: "Products", href: "/products" },
    ...(p.category ? [{ label: p.category.name, href: `/products/category/${p.category.slug}` }] : []),
    { label: p.title },
  ];
  const videoNodes = p.videos.map((v) => videoObject(v, absoluteUrl(`/products/${p.slug}`))).filter(Boolean) as Record<string, unknown>[];
  const hasSpecs = p.specs.length > 0;
  const hasVideos = p.videos.length > 0;
  const toc = [
    { id: "overview", label: "Overview" },
    ...(hasSpecs ? [{ id: "specifications", label: "Specifications" }] : []),
    ...(hasVideos ? [{ id: "video", label: "Video" }] : []),
  ];

  return (
    <>
      <Breadcrumbs items={crumbs} />
      <section className="section-md pb-0">
        <div className="container-site grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="relative m-3 aspect-[4/3]">
              <div className="plate absolute inset-0" />
              <div className="relative size-full overflow-hidden border border-[#E5E7EB] bg-white">
                <CmsImage media={p.image} sizes="(min-width:1024px) 58vw, 100vw" priority fit="contain" className="p-8" caption={p.title} />
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="flex flex-wrap gap-2">
              {p.country.name ? <span className="inline-flex items-center gap-2 border border-[#D1D5DB] bg-white px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-[#374151]"><span aria-hidden className="h-3 w-[3px] bg-[#843C40]" />{p.country.name}</span> : null}
              {p.brand?.name ? <span className="inline-flex items-center bg-[#2F447D] px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-white">Official agent</span> : null}
            </div>
            <h1 className="t-h1 mt-5 text-foreground">{p.title}</h1>
            {p.brand ? (
              <p className="mt-3 text-[#374151]">by <Link href={`/brands/${p.brand.slug}`} className="font-semibold text-[#2F447D] underline underline-offset-[3px]">{p.brand.name}</Link></p>
            ) : null}
            <p className="t-lead mt-5 text-[#374151]">{p.shortDescription}</p>
            {p.features.length ? (
              <ul className="mt-6 space-y-2">
                {p.features.slice(0, 5).map((f) => <li key={f} className="ring-bullet">{f}</li>)}
              </ul>
            ) : null}
            <div className="mt-8 flex flex-col gap-3">
              <Button asChild variant="accent" size="lg" className="w-full">
                <Link href={`/contact?product=${p.slug}&subject=quote`}>Request a quote</Link>
              </Button>
              <div className="flex flex-wrap gap-3">
                <ShareButton url={absoluteUrl(`/products/${p.slug}`)} title={p.title} variant="outline" />
                {p.inquiryEnabled ? <Button asChild variant="outline"><Link href="/contact"><MessageCircle aria-hidden className="size-5" />Ask a question</Link></Button> : null}
              </div>
              <p className="flex items-center gap-2 text-sm text-[#4B5563]"><Phone aria-hidden className="size-4" />Questions? Call <a href="tel:+251911514558" className="font-medium text-[#0D5380]">+251 911 514558</a></p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-md">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <nav aria-label="On this page" className="lg:col-span-3">
            <ProductTocNav items={toc} />
          </nav>
          <div className="space-y-20 lg:col-span-8 lg:col-start-5">
            <div id="overview" className="scroll-mt-40">
              <h2 className="t-h2 text-foreground">Overview</h2>
              <RichHtml html={p.contentHtml} className="mt-6" />
              <dl className="mt-10 grid grid-cols-2 gap-4 border-t-2 border-[#111827] pt-6 text-[15px] sm:grid-cols-4">
                {p.brand ? <div><dt className="eyebrow !text-[11px] !text-[#6B7280]">Brand</dt><dd className="mt-1 font-semibold">{p.brand.name}</dd></div> : null}
                {p.country.name ? <div><dt className="eyebrow !text-[11px] !text-[#6B7280]">Origin</dt><dd className="mt-1 font-semibold">{p.country.name}</dd></div> : null}
                {p.category ? <div><dt className="eyebrow !text-[11px] !text-[#6B7280]">Category</dt><dd className="mt-1 font-semibold">{p.category.name}</dd></div> : null}
              </dl>
            </div>
            {hasSpecs ? (
              <div id="specifications" className="scroll-mt-40">
                <h2 className="t-h2 text-foreground">Specifications</h2>
                <div className="mt-6"><SpecTable specs={p.specs} /></div>
              </div>
            ) : null}
            {hasVideos ? (
              <div id="video" className="scroll-mt-40">
                <h2 className="t-h2 text-foreground">Video</h2>
                <div className="mt-6 space-y-6">{p.videos.map((v) => <VideoPlayer key={v.id} video={v} />)}</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="inquiry-h" className="section-navy section-sm bg-[#111827] text-white">
        <div className="container-site flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="inquiry-h" className="t-h3 text-white">Interested in {p.title}?</h2>
            <p className="mt-2 text-[#D1D5DB]">Send us the details of your site and we will confirm availability.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="tel:+251911514558" className="font-display text-2xl font-semibold text-white hover:underline">+251 911 514558</a>
            <Button asChild variant="primary" className="bg-white text-[#111827] hover:bg-[#EEF1F8]"><Link href={`/contact?product=${p.slug}&subject=quote`}>Request a quote</Link></Button>
          </div>
        </div>
      </section>

      {p.related.length ? (
        <Section id="related" title="Related products" tone="light">
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {p.related.map((r) => <li key={r.id}><ProductCard product={r} /></li>)}
          </ul>
        </Section>
      ) : null}
      <JsonLd data={[...p.seo.jsonLd, ...videoNodes]} />
    </>
  );
}
