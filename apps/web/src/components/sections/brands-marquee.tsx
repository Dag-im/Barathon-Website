import Link from "next/link";
import { CmsImage } from "@/components/media/cms-image";
import type { BlockDto } from "@/lib/api/types";
import { Section } from "./section";

type Block = Extract<BlockDto, { type: "BRANDS_MARQUEE" }>;

/** Logo marquee (design 7.1, 5.3). CSS-only; paused on hover/focus; static under reduced motion. */
export function BrandsMarqueeSection({ block }: { block: Block }) {
  if (!block.brands.length) return null;
  const cell = (b: Block["brands"][number]) => (
    <li key={b.id} className="flex h-20 w-[140px] shrink-0 items-center justify-center px-4 md:w-[180px]">
      <Link href={b.href} aria-label={`${b.name}, ${b.country.name ?? ""}`.trim()} className="relative block h-10 w-full">
        <CmsImage media={b.logo} sizes="180px" fit="contain" variant="logo" caption={b.name} className="opacity-70 grayscale transition duration-150 hover:opacity-100 hover:grayscale-0" />
      </Link>
    </li>
  );
  return (
    <Section id="brands" title={block.title ?? "Brands We Work With"} subtitle={block.subtitle ?? undefined} size="sm" tone="white" className="border-b border-[#E5E7EB]">
      <div className="marquee-wrap edge-mask overflow-hidden">
        <ul className="marquee-track flex w-max motion-reduce:flex-wrap motion-reduce:w-full motion-reduce:animate-none">
          {block.brands.map(cell)}
        </ul>
        <ul aria-hidden="true" inert className="marquee-track flex w-max motion-reduce:hidden">
          {block.brands.map((b) => <li key={`dup-${b.id}`} className="flex h-20 w-[140px] shrink-0 items-center justify-center px-4 md:w-[180px]"><span className="block h-10 w-full" /></li>)}
        </ul>
      </div>
    </Section>
  );
}
