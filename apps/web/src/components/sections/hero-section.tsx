import Link from "next/link";
import { HeroCarousel } from "./hero-carousel";
import type { BlockDto } from "@/lib/api/types";
import { Eyebrow } from "@/components/content/eyebrow";

type Hero = Extract<BlockDto, { type: "HERO_CAROUSEL" }>;

/** Hero band with the persistent h1 headline (design 7.1). Falls back to the page title when no slides exist. */
export function HeroSection({ block, headline, subheadline, eyebrow }: { block: Hero; headline?: string; subheadline: string | null; eyebrow?: string | null }) {
  if (!block.slides.length) {
    return (
      <section aria-labelledby="hero-heading" className="section-navy bg-[#111B38] py-24 text-white">
        <div className="container-site"><h1 id="hero-heading" className="t-display max-w-[14ch] text-white">{headline}</h1></div>
      </section>
    );
  }
  return (
    <section aria-label="Featured product lines">
      <HeroCarousel
        slides={block.slides}
        headline={headline ?? block.title ?? "Baraton Group Co."}
        subheadline={subheadline}
        autoplayMs={block.autoplayMs}
        eyebrow={eyebrow ?? "Official agent of Furukawa Rock Drill and Airman in Ethiopia"}
        ctaPrimary={{ label: "Explore products", href: "/products" }}
      />
      <FactsStrip />
    </section>
  );
}

/** Facts strip under the hero (design 7.1). Values come from the page data where possible. */
function FactsStrip() {
  const facts = [
    { value: "2007", label: "Founded" },
    { value: "Furukawa and Airman", label: "Official agent in Ethiopia" },
    { value: "2019", label: "USA subsidiary, Baraton Trade LLC" },
    { value: "Addis Ababa", label: "Bole Road, Wollo Sefer" },
  ];
  return (
    <div className="bg-[#0B1220] text-white">
      <dl className="container-site grid grid-cols-2 gap-y-6 py-6 md:grid-cols-4 md:divide-x md:divide-white/12">
        {facts.map((f) => (
          <div key={f.label} className="md:px-6 first:md:ps-0">
            <dt className="order-2 text-[13px] font-medium uppercase tracking-[0.06em] text-[#9CA3AF]">{f.label}</dt>
            <dd className="font-display text-[28px] leading-8 font-bold">{f.value}</dd>
          </div>
        ))}
      </dl>
      <span className="sr-only"><Eyebrow>Key facts</Eyebrow></span>
      <Link href="/about" className="sr-only">About the group</Link>
    </div>
  );
}
