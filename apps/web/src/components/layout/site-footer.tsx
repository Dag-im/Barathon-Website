import Link from "next/link";
import { Phone, Mail, MapPin, ArrowRight } from "lucide-react";
import { Logo } from "./logo";
import { SocialIcon } from "@/components/icons/social";
import { DEVELOPER_CREDIT } from "@/lib/constants";
import type { SiteDto } from "@/lib/api/types";

type SocialKey = keyof typeof SocialIcon;

/** Footer (design 6.8). The developer credit is fixed in code (amendment A4). */
export function SiteFooter({ site }: { site: SiteDto }) {
  const year = new Date().getFullYear();
  const copyright = site.footer.copyright.replace("{year}", String(year));
  const office = site.offices.find((o) => o.isPrimary) ?? site.offices[0];
  const phones = site.channels.filter((c) => c.type === "PHONE" && c.showInFooter);
  const email = site.channels.find((c) => c.type === "EMAIL" && c.showInFooter);
  const socials = site.social.filter((s) => s.showInFooter);
  return (
    <footer className="section-footer bg-[#0B1220] text-[#D1D5DB]">
      <div className="container-site pt-12 pb-10 lg:pt-[72px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <Logo variant="full" tone="white" className="h-10" />
            {site.footer.blurb ? <p className="mt-5 max-w-[36ch] text-sm leading-[22px] text-[#D1D5DB]">{site.footer.blurb}</p> : null}
            {socials.length ? (
              <ul className="mt-6 flex gap-2">
                {socials.map((s) => {
                  const Icon = SocialIcon[s.platform as SocialKey];
                  return (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label ?? s.platform.toLowerCase()} className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-[#60A5FA] hover:text-[#0B1220]">
                        {Icon ? <Icon /> : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <nav aria-label="Footer" className="lg:col-span-2">
            <h2 className="text-lg font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>Quick Links</h2>
            <ul className="mt-4 space-y-1">
              {site.menus.FOOTER_QUICK.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="group flex h-9 items-center gap-2 text-[15px] hover:text-white">
                    <ArrowRight aria-hidden className="size-3.5 text-[#60A5FA] transition-transform group-hover:translate-x-1" />{l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Our products" className="lg:col-span-3">
            <h2 className="text-lg font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>Our Products</h2>
            <ul className="mt-4 space-y-1">
              {site.menus.FOOTER_PRODUCTS.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="group flex h-9 items-center gap-2 text-[15px] hover:text-white">
                    <ArrowRight aria-hidden className="size-3.5 text-[#60A5FA] transition-transform group-hover:translate-x-1" />{l.label}
                  </Link>
                </li>
              ))}
              <li><Link href="/products" className="flex h-9 items-center text-[15px] font-medium text-[#60A5FA] hover:text-white">All products</Link></li>
            </ul>
          </nav>
          <div className="lg:col-span-3">
            <h2 className="text-lg font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>Contact Us</h2>
            <address className="mt-4 space-y-3 not-italic">
              {office && office.lines.length ? (
                <p className="flex gap-3"><MapPin aria-hidden className="mt-0.5 size-[18px] shrink-0 text-[#60A5FA]" /><span>{office.lines.map((l) => <span key={l} className="block">{l}</span>)}</span></p>
              ) : null}
              {phones.length ? (
                <p className="flex gap-3"><Phone aria-hidden className="mt-0.5 size-[18px] shrink-0 text-[#60A5FA]" />
                  <span className="flex flex-col">{phones.map((p) => <a key={p.id} href={p.href} className="whitespace-nowrap hover:text-white">{p.displayValue}</a>)}</span>
                </p>
              ) : null}
              {email ? <p className="flex gap-3"><Mail aria-hidden className="mt-0.5 size-[18px] shrink-0 text-[#60A5FA]" /><a href={email.href} className="break-all hover:text-white">{email.displayValue}</a></p> : null}
            </address>
          </div>
        </div>
      </div>
      <div className="border-t border-white/12">
        <div className="container-site flex flex-col gap-4 py-6 text-[13px] text-[#9CA3AF] md:flex-row md:items-center md:justify-between">
          <p>{copyright}</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            {site.menus.FOOTER_LEGAL.map((l) => (
              <Link key={l.id} href={l.href} className="hover:text-white">{l.label}</Link>
            ))}
          </nav>
          <p className="text-[13px]">
            {DEVELOPER_CREDIT.text}{" "}
            {env_developerUrl ? (
              <a href={env_developerUrl} className="font-medium text-white underline-offset-4 hover:underline">{DEVELOPER_CREDIT.name}</a>
            ) : (
              <span className="font-medium text-white">{DEVELOPER_CREDIT.name}</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}

const env_developerUrl = process.env.NEXT_PUBLIC_DEVELOPER_URL ?? "";
