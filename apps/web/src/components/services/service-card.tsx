import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ServiceCardDto } from "@/lib/api/types";

/** Service card: navy panel with index numeral and ring bullets (design 6.5). */
export function ServiceCard({ service, index }: { service: ServiceCardDto; index: number }) {
  return (
    <article className="section-navy relative flex flex-col overflow-hidden bg-[#1F2937] p-8 text-white">
      <span aria-hidden className="index-numeral absolute end-6 top-2">{String(index + 1).padStart(2, "0")}</span>
      <h3 className="relative mt-16 text-[28px] leading-[34px] font-semibold text-white">{service.title}</h3>
      <p className="relative mt-3 line-clamp-3 text-[#D1D5DB]">{service.shortDescription}</p>
      {service.features.length ? (
        <ul className="relative mt-6 space-y-2 text-[#D1D5DB]">
          {service.features.slice(0, 3).map((f) => <li key={f.title} className="ring-bullet text-[15px]">{f.title}</li>)}
        </ul>
      ) : null}
      <Link href={service.href} className="relative mt-auto inline-flex items-center gap-1 pt-8 font-medium text-[#60A5FA] underline underline-offset-[3px] hover:text-white">
        Learn more<span className="sr-only"> about {service.title}</span><ArrowRight aria-hidden className="size-4" />
      </Link>
    </article>
  );
}
