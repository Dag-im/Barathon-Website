import type { Metadata } from "next";
import { getSite } from "@/lib/api/public";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/components/forms/contact-form";
import { MapEmbed } from "@/components/forms/map-embed";
import { Section } from "@/components/sections/section";
import { JsonLd } from "@/components/seo-jsonld";
import { breadcrumbList, localBusiness } from "@/lib/seo/jsonld";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { SocialIcon } from "@/components/icons/social";
import { absoluteUrl } from "@/lib/seo/urls";

export const metadata: Metadata = {
  title: { absolute: "Contact Us | Baraton Group Co." },
  description: "Contact Baraton Group Co. in Addis Ababa: phone, email and address. Send a quote or service request through the form.",
  alternates: { canonical: absoluteUrl("/contact") },
  openGraph: { title: "Contact Us", url: absoluteUrl("/contact") },
};

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ContactPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const site = await getSite();
  const offices = site.offices.filter((o) => o.lines.length);
  const phones = site.channels.filter((c) => c.type === "PHONE" && c.showOnContactPage);
  const email = site.channels.find((c) => c.type === "EMAIL" && c.showOnContactPage);
  const socials = site.social.filter((s) => s.showOnContactPage);
  const subject = one(sp.subject);
  const product = one(sp.product);
  const service = one(sp.service);
  const brand = one(sp.brand);
  const prefill = {
    subject: subject === "quote" ? "Product quote" : subject === "service" ? "Service request" : subject === "partnership" ? "Partnership" : "",
    productSlug: product,
    serviceSlug: service,
    brandSlug: brand,
  };
  return (
    <>
      <PageHeader eyebrow="Contact" title="Contact Us" intro="Fill out the form or contact us through these channels." crumbs={[{ label: "Contact Us" }]} />
      <section className="section-md bg-[#F8F9FA]">
        <div className="container-site grid overflow-hidden border border-[#E5E7EB] bg-white shadow-sm md:grid-cols-12">
          <aside className="section-navy order-2 bg-[#111827] p-8 text-white md:order-1 md:col-span-5 lg:p-12" aria-labelledby="info-h">
            <h2 id="info-h" className="t-h3 text-white">Contact Information</h2>
            <p className="mt-2 text-[#D1D5DB]">We reply within one business day.</p>
            <ul className="mt-8 space-y-7">
              {phones.length ? (
                <li className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/8"><Phone aria-hidden className="size-4" /></span>
                  <div>
                    <p className="font-display text-lg font-semibold">Phone</p>
                    <ul className="mt-1 space-y-1 text-[#D1D5DB]">{phones.map((p) => <li key={p.id}><a href={p.href} className="whitespace-nowrap hover:text-white">{p.displayValue}</a></li>)}</ul>
                  </div>
                </li>
              ) : null}
              {email ? (
                <li className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/8"><Mail aria-hidden className="size-4" /></span>
                  <div><p className="font-display text-lg font-semibold">Email</p><a href={email.href} className="break-all text-[#D1D5DB] hover:text-white">{email.displayValue}</a></div>
                </li>
              ) : null}
              {offices.map((o) => (
                <li key={o.id} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/8"><MapPin aria-hidden className="size-4" /></span>
                  <address className="not-italic">
                    <p className="font-display text-lg font-semibold">{o.name}</p>
                    {o.lines.map((l) => <span key={l} className="block text-[#D1D5DB]">{l}</span>)}
                    {o.openingHours?.length ? <span className="mt-2 flex items-center gap-2 text-[#D1D5DB]"><Clock aria-hidden className="size-4" />{o.openingHours.map((h) => `${h.days} ${h.open}-${h.close}`).join(", ")}</span> : null}
                  </address>
                </li>
              ))}
            </ul>
            {socials.length ? (
              <div className="mt-10 border-t border-white/12 pt-8">
                <p className="font-display text-lg font-semibold">Follow Us</p>
                <ul className="mt-4 flex gap-2">
                  {socials.map((s) => {
                    const Icon = SocialIcon[s.platform as keyof typeof SocialIcon];
                    return <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label ?? s.platform.toLowerCase()} className="grid size-9 place-items-center rounded-full bg-white/8 hover:bg-[#60A5FA] hover:text-[#0B1220]">{Icon ? <Icon /> : null}</a></li>;
                  })}
                </ul>
              </div>
            ) : null}
          </aside>
          <div className="order-1 p-8 md:order-2 md:col-span-7 lg:p-12">
            <h2 className="t-h3 text-foreground">Send us a message</h2>
            <div className="mt-8">
              <ContactForm prefill={prefill} />
            </div>
          </div>
        </div>
      </section>
      {offices.length ? (
        <Section id="find-us" title="Find us" tone="white" size="md">
          <MapEmbed offices={offices} />
        </Section>
      ) : null}
      <JsonLd data={[
        { "@type": "ContactPage", name: "Contact Us", url: absoluteUrl("/contact") },
        ...offices.map((o) => localBusiness(o, site)),
        breadcrumbList([{ label: "Home", href: "/" }, { label: "Contact Us", href: "/contact" }]),
      ]} />
    </>
  );
}
