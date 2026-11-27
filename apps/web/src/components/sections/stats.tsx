import type { BlockDto } from "@/lib/api/types";

type Block = Extract<BlockDto, { type: "STATS" }>;

/** Stat strip (design 6.5 stat items): hairline-divided numerals with a burgundy tick. */
export function StatsSection({ block }: { block: Block }) {
  if (!block.stats.length) return null;
  return (
    <section aria-label="Key figures" className="section-sm bg-[#F8F9FA]">
      <dl className="container-site grid grid-cols-2 gap-y-8 md:grid-cols-4 md:divide-x md:divide-[#E5E7EB]">
        {block.stats.map((s) => (
          <div key={s.id} className="px-0 md:px-8 first:md:ps-0">
            <span aria-hidden className="mb-3 block h-6 w-[3px] bg-[#843C40]" />
            <dt className="order-2 mt-2 text-xs font-medium uppercase tracking-[0.06em] text-[#4B5563]">{s.label}</dt>
            <dd className="font-display text-[44px] leading-none font-bold text-[#2F447D] lg:text-[64px]">
              {s.prefix ?? ""}{s.value >= 1900 && s.value <= 2100 ? String(s.value) : s.value.toLocaleString("en-US")}{s.suffix ?? ""}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
