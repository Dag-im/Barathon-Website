import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/api/public";
import { listMetadata } from "@/lib/seo/list";
import { PageHeader } from "@/components/layout/page-header";
import { StatusEmpty } from "@/components/content/status-empty";
import { Section } from "@/components/sections/section";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo-jsonld";
import { breadcrumbList } from "@/lib/seo/jsonld";

export const metadata: Metadata = listMetadata({ title: "Our Services", description: "Genuine parts and accessories, maintenance and service for rock drilling, compressed air and construction machinery in Ethiopia.", path: "/services" });

export default async function ServicesPage() {
  const { data } = await getServices();
  return (
    <>
      <PageHeader eyebrow="Service" title="Our Services" intro="Fast access to the right parts, technical support and planned maintenance to keep machines running at peak performance." crumbs={[{ label: "Services" }]} />
      <Section id="service-rows" tone="white" size="lg">
        {data.length ? (
          <ul>
            {data.map((s, i) => (
              <li key={s.id} className="grid gap-8 border-t-2 border-[#111827] py-16 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <p className="index-numeral text-[96px] leading-none">{String(i + 1).padStart(2, "0")}</p>
                </div>
                <div className="lg:col-span-5">
                  <h2 className="t-h2 text-foreground"><Link href={s.href} className="hover:underline">{s.title}</Link></h2>
                  <p className="mt-4 text-[18px] leading-7 text-[#374151]">{s.shortDescription}</p>
                  <Link href={s.href} className="mt-6 inline-block font-medium text-[#0D5380] underline underline-offset-[3px]">Learn more about {s.title}</Link>
                </div>
                <div className="rounded-none border border-[#E5E7EB] bg-[#F8F9FA] p-6 lg:col-span-4">
                  <h3 className="eyebrow">What is included</h3>
                  <ul className="mt-4 space-y-3">
                    {s.features.slice(0, 5).map((f) => <li key={f.title} className="ring-bullet text-[15px]">{f.title}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <StatusEmpty title="No services found" action={<Button asChild><Link href="/contact">Contact us</Link></Button>} />
        )}
      </Section>
      <Section id="service-cta" tone="navy" size="md">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="t-h3 text-white">Request a service visit or a parts quote.</p>
          <Button asChild variant="primary" className="bg-white text-[#111827] hover:bg-[#EEF1F8]"><Link href="/contact?subject=service">Request a service</Link></Button>
        </div>
      </Section>
      <JsonLd data={breadcrumbList([{ label: "Home", href: "/" }, { label: "Services", href: "/services" }])} />
    </>
  );
}
