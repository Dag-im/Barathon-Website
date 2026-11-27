import type { Metadata } from "next";
import Link from "next/link";
import { getBrands } from "@/lib/api/public";
import { listMetadata } from "@/lib/seo/list";
import { PageHeader } from "@/components/layout/page-header";
import { BrandCard } from "@/components/brands/brand-card";
import { CmsImage } from "@/components/media/cms-image";
import { Section } from "@/components/sections/section";
import { StatusEmpty } from "@/components/content/status-empty";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo-jsonld";
import { breadcrumbList } from "@/lib/seo/jsonld";

export const metadata: Metadata = listMetadata({ title: "Brands We Work With", description: "The principal brands and partners we represent in Ethiopia, including the official agent of Furukawa and Airman.", path: "/brands" });

export default async function BrandsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const country = Array.isArray(sp.country) ? sp.country[0] : sp.country;
  const data = await getBrands({ country: country ?? undefined });
  const all = data.data;
  const agents = all.filter((b) => b.isExclusiveAgent);
  const countries = [...new Set(all.map((b) => b.country.name).filter(Boolean))] as string[];
  return (
    <>
      <PageHeader eyebrow="Partners" title="Brands We Work With" intro="Trusted by industry leaders worldwide. Each brand below is supplied through our group, with agent status where noted." crumbs={[{ label: "Brands" }]} />
      {!country && agents.length ? (
        <section aria-labelledby="agents-h" className="section-navy section-md bg-[#111827] text-white">
          <div className="container-site">
            <p className="eyebrow text-white"><span>Official agent in Ethiopia</span></p>
            <h2 id="agents-h" className="t-h2 mt-3 text-white sr-only">Official agents</h2>
            <ul className="mt-8 grid gap-6 lg:grid-cols-2">
              {agents.map((b) => (
                <li key={b.id} className="grid gap-6 border border-white/12 p-6 sm:grid-cols-[200px_1fr]">
                  <div className="relative aspect-[3/2] bg-white p-8"><CmsImage media={b.logo} sizes="200px" fit="contain" variant="logo" caption={b.name} /></div>
                  <div>
                    <h3 className="t-h3 text-white">{b.name}</h3>
                    <p className="mt-2 text-[#D1D5DB] line-clamp-3">{b.shortDescription}</p>
                    <Link href={b.href} className="mt-4 inline-block font-medium text-[#60A5FA] underline underline-offset-[3px] hover:text-white">View brand<span className="sr-only"> {b.name}</span></Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      <Section id="all-brands" title="All brands" tone="light" size="lg" headingAction={<ul className="flex flex-wrap gap-2" aria-label="Filter by country">
        <li><Link href="/brands" className="inline-flex h-9 items-center border border-[#2F447D] bg-[#2F447D] px-3.5 text-sm text-white">All</Link></li>
        {countries.map((c) => (<li key={c}><Link href={`/brands?country=${encodeURIComponent(c)}`} className="inline-flex h-9 items-center border border-[#D1D5DB] bg-white px-3.5 text-sm text-[#374151] hover:border-[#2F447D]">{c}</Link></li>))}
      </ul>}>
        {all.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{all.map((b) => <li key={b.id}><BrandCard brand={b} /></li>)}</ul>
        ) : (
          <StatusEmpty title="No brands found" action={<Button asChild variant="outline"><Link href="/contact">Contact us</Link></Button>} />
        )}
      </Section>
      <Section id="brand-cta" tone="navy" size="md">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="t-h3 max-w-[30ch] text-white">Looking for a brand that is not listed?</p>
          <Button asChild variant="primary" className="bg-white text-[#111827] hover:bg-[#EEF1F8]"><Link href="/contact?subject=partnership">Tell us what you need</Link></Button>
        </div>
      </Section>
      <JsonLd data={breadcrumbList([{ label: "Home", href: "/" }, { label: "Brands", href: "/brands" }])} />
    </>
  );
}
