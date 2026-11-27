import Link from "next/link";
import { ProductCard } from "@/components/products/product-card";
import { Section } from "./section";
import type { BlockDto } from "@/lib/api/types";

type Block = Extract<BlockDto, { type: "FEATURED_PRODUCTS" }>;

export function FeaturedProductsSection({ block }: { block: Block }) {
  if (!block.products.length) return null;
  const countries = [...new Set(block.products.map((p) => p.country.name).filter(Boolean))] as string[];
  return (
    <Section id="featured-products" eyebrow="Catalogue" title={block.title ?? "Our Products"} headingAction={block.viewAll ? <Link href={block.viewAll.href} className="font-medium text-[#0D5380] underline underline-offset-[3px]">{block.viewAll.label}</Link> : null}>
      <ul className="mb-8 flex flex-wrap gap-2" aria-label="Filter by country">
        {countries.map((c) => (
          <li key={c}><Link href={`/products?country=${encodeURIComponent(c)}`} className="inline-flex h-9 items-center border border-[#D1D5DB] bg-white px-3.5 text-sm text-[#374151] hover:border-[#2F447D] hover:text-[#2F447D]">{c}</Link></li>
        ))}
      </ul>
      <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {block.products.map((p, i) => <li key={p.id}><ProductCard product={p} priority={i === 0} /></li>)}
      </ul>
    </Section>
  );
}
