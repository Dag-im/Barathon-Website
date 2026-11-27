import { RichHtml } from "@/components/content/rich-html";
import { CmsImage } from "@/components/media/cms-image";
import { Section } from "./section";
import type { BlockDto } from "@/lib/api/types";
import { Check } from "lucide-react";
import Link from "next/link";
import { BrandCard } from "@/components/brands/brand-card";

type Of<T extends BlockDto["type"]> = Extract<BlockDto, { type: T }>;

/** Vertical timeline with ring nodes (design 7.2 section 2). */
export function TimelineSection({ block }: { block: Of<"TIMELINE"> }) {
  if (!block.entries.length) return null;
  return (
    <Section id={block.anchorId ?? "timeline"} title="Our story" eyebrow="History" tone="white">
      <ol className="relative ms-2 space-y-12 border-s border-[#D1D5DB] ps-10">
        {block.entries.map((e, i) => (
          <li key={e.id} className="relative">
            <span aria-hidden className={`absolute -start-[45px] top-1.5 block size-4 rounded-full border-2 ${i === block.entries.length - 1 ? "border-[#843C40] bg-[#843C40]" : "border-[#2F447D] bg-white"}`} />
            <p className="font-display text-[28px] leading-8 font-bold text-[#2F447D]">{e.yearLabel}</p>
            <h3 className="mt-2 text-xl font-semibold">{e.title}</h3>
            <RichHtml html={e.descriptionHtml} className="mt-2 text-[#374151]" />
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** CEO message on a navy band with a portrait placeholder (design 7.2 section 3). */
export function LeaderSection({ block }: { block: Of<"LEADER_MESSAGE"> }) {
  const l = block.leader;
  if (!l) return null;
  return (
    <Section id="ceo-message" title={l.heading} tone="navy" headingLevel={2} size="lg">
      <div className="grid gap-12 lg:grid-cols-12">
        <figure className="lg:col-span-4">
          <div className="plate relative aspect-[4/5] bg-[#25376A]"><div className="absolute inset-0 overflow-hidden"><CmsImage media={l.photo} sizes="(min-width:1024px) 33vw, 80vw" caption={l.name ?? "CEO"} /></div></div>
          {l.name || l.jobTitle ? <figcaption className="mt-6 text-sm text-[#D1D5DB]">{[l.name, l.jobTitle].filter(Boolean).join(", ")}</figcaption> : null}
        </figure>
        <div className="lg:col-span-7 lg:col-start-6">
          <span aria-hidden className="mb-6 block h-12 w-1 bg-[#D08A90]" />
          <RichHtml html={l.messageHtml} className="font-display text-[22px] leading-8 font-medium text-white [&_p+p]:mt-6 [&_p+p]:font-sans [&_p+p]:text-[18px] [&_p+p]:font-normal [&_p+p]:leading-[30px] [&_p+p]:text-[#D1D5DB]" />
        </div>
      </div>
    </Section>
  );
}

/** Mission as numbered rows, vision as a bordered panel (design 7.2 section 4). */
export function MissionVisionSection({ block }: { block: Of<"MISSION_VISION"> }) {
  return (
    <Section id="philosophy" title={undefined} eyebrow="Philosophy">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="t-h2 text-foreground">{block.missionTitle}</h2>
          <ol className="mt-8 divide-y divide-[#D1D5DB] border-y border-[#D1D5DB]">
            {block.missionItems.map((m, i) => (
              <li key={m.id} className="grid grid-cols-[48px_1fr] gap-4 py-5">
                <span className="font-display text-[22px] font-semibold text-[#2F447D]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[18px] leading-7 text-[#111827]">{m.title}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:col-span-4 lg:col-start-9">
          <div className="relative border border-[#E5E7EB] bg-white p-10">
            <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[#2F447D]" />
            <h2 className="font-display text-[26px] font-semibold text-[#2F447D]">{block.visionTitle}</h2>
            <RichHtml html={block.visionHtml} className="mt-4 font-display text-xl leading-8 text-[#111827]" />
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Capabilities as a single row of hairline-divided items (design 7.2 section 6). */
export function CoreValuesSection({ block }: { block: Of<"CORE_VALUES"> }) {
  if (!block.values.length) return null;
  return (
    <section aria-labelledby="capabilities-h" className="section-navy section-md bg-[#111827] text-white">
      <div className="container-site">
        <h2 id="capabilities-h" className="sr-only">Capabilities</h2>
        <ul className="grid gap-px bg-white/12 sm:grid-cols-2 lg:grid-cols-4">
          {block.values.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 bg-[#111827] p-6">
              <Check aria-hidden className="size-8 text-[#60A5FA]" strokeWidth={1.5} />
              <p className="font-display text-xl font-semibold text-white">{v.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Subsidiary ledger rows with anchors (design 7.2 section 5). */
export function SubsidiariesSection({ block }: { block: Of<"SUBSIDIARIES"> }) {
  return (
    <Section id="subsidiaries" title="Our subsidiaries" eyebrow="Group" tone="white">
      <div className="space-y-16">
        {block.subsidiaries.map((s, i) => (
          <article key={s.id} id={s.anchorId} className="scroll-mt-40 border-t-2 border-[#111827] pt-10 grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="index-numeral text-[96px] leading-none">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 t-h2 text-foreground">{s.name}</h3>
              {s.regionNote ? <p className="mt-3 inline-flex border border-[#D1D5DB] px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-[#374151]">{s.regionNote}</p> : null}
              {s.tagline ? <p className="mt-3 inline-flex bg-[#2F447D] px-2 py-1 text-xs font-medium uppercase tracking-[0.06em] text-white">{s.tagline}</p> : null}
            </div>
            <div className="lg:col-span-7 lg:col-start-6 space-y-5 text-[#374151]">
              <RichHtml html={s.introHtml} />
              {s.bodyHtml ? <RichHtml html={s.bodyHtml} /> : null}
              {s.lists.map((l) => (
                <div key={l.title}>
                  <h4 className="eyebrow mb-3">{l.title}</h4>
                  <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {l.items.map((it) => <li key={it} className="ring-bullet">{it}</li>)}
                  </ul>
                </div>
              ))}
              {s.partnerBrands.length ? (
                <table className="spec-table text-[15px]">
                  <tbody>
                    {s.partnerBrands.map((p) => (
                      <tr key={p.brand.id}>
                        <th scope="row" className="font-medium">{p.brand.name}</th>
                        <td>{p.brand.country.name}</td>
                        <td className="text-[#4B5563]">{p.relation === "OFFICIAL_AGENT" ? "Official agent" : "Exclusive sales and marketing rights"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {s.websiteUrl ? <Link href={s.websiteUrl} className="underline">{s.name} website</Link> : null}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

export { BrandCard };
