import Link from "next/link";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlockDto } from "@/lib/api/types";

type Block = Extract<BlockDto, { type: "CTA_BANNER" }>;

/** Navy closing band (design 7.1 section 10). Followed by the navy footer with a seam. */
export function CtaBannerSection({ block }: { block: Block }) {
  return (
    <section aria-labelledby={`${block.id}-h`} className="section-navy relative overflow-hidden bg-[#111827] text-white section-lg">
      <div className="container-site grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-8">
          <h2 id={`${block.id}-h`} className="t-h2 max-w-[24ch] text-white">{block.heading}</h2>
          {block.text ? <p className="t-lead mt-4 max-w-[52ch] text-[#D1D5DB]">{block.text}</p> : null}
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4">
          {block.buttons.map((b, i) => (
            <Button key={b.label} asChild variant="primary" size="lg" className="w-full justify-center bg-white text-[#111827] hover:bg-[#EEF1F8]">
              <Link href={b.href}>{i === 0 ? <Phone aria-hidden className="size-5" /> : null}{b.label}</Link>
            </Button>
          ))}
          <a href="tel:+251911514558" className="font-display text-[28px] leading-8 font-semibold text-white hover:underline">+251 911 514558</a>
          <a href="mailto:aboma.taye@gmail.com" className="text-[#60A5FA] hover:text-white">aboma.taye@gmail.com</a>
        </div>
      </div>
    </section>
  );
}
