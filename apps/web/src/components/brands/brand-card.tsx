import Link from "next/link";
import { CmsImage } from "@/components/media/cms-image";
import type { BrandCardDto } from "@/lib/api/types";
import { Check } from "lucide-react";
import { truncate } from "@/lib/utils/format";

/** Brand card (design 6.5): 3:2 logo tile, name, country tick, official agent badge. */
export function BrandCard({ brand }: { brand: BrandCardDto }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[3/2] border border-[#E5E7EB] bg-white">
        <div className="absolute inset-6">
          <CmsImage media={brand.logo} sizes="(min-width:1024px) 280px, (min-width:640px) 45vw, 45vw" alt={brand.name} fit="contain" variant="logo" className="grayscale transition duration-150 group-hover:grayscale-0" />
        </div>
        {brand.isExclusiveAgent ? (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1 bg-[#2F447D] px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-white">
            <Check aria-hidden className="size-3" />Official agent
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-xl leading-[26px] font-semibold"><Link href={brand.href} className="after:absolute after:inset-0">{brand.name}</Link></h3>
          {brand.country.name ? <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.06em] text-[#374151]"><span aria-hidden className="h-3 w-[3px] bg-[#843C40]" />{brand.country.name}</span> : null}
        </div>
        <p className="line-clamp-2 text-sm text-[#4B5563]">{truncate(brand.shortDescription, 160)}</p>
        <span className="mt-auto inline-flex text-[#0D5380] underline underline-offset-[3px]">View brand<span className="sr-only"> {brand.name}</span></span>
      </div>
    </article>
  );
}
