import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CmsImage } from "@/components/media/cms-image";
import type { ProductCardDto } from "@/lib/api/types";

/** Product card (design 6.5): 4:3 plate, country tick badge, title, clamp description. */
export function ProductCard({ product, priority = false }: { product: ProductCardDto; priority?: boolean }) {
  return (
    <article data-testid={`product-card-${product.slug}`} className="group relative flex flex-col border border-[#E5E7EB] bg-white transition-[border-color,box-shadow] duration-150 hover:border-[#BCC8E2] hover:shadow-sm">
      <div className="relative m-3 mb-7 aspect-[4/3] overflow-visible">
        <div className="plate absolute inset-0 overflow-visible" />
        <div className="relative size-full overflow-hidden bg-white">
          <CmsImage media={product.image} sizes="(min-width:1024px) 384px, (min-width:640px) 50vw, 100vw" alt={product.image?.alt ?? product.title} priority={priority} fit="contain" caption={product.title} className="p-6 transition-transform duration-[400ms] group-hover:scale-[1.03]" />
        </div>
        {product.country.name ? (
          <span className="absolute start-3 top-3 z-10 inline-flex items-center gap-2 border border-[#D1D5DB] bg-white px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-[#374151]">
            <span aria-hidden className="h-3 w-[3px] bg-[#843C40]" />{product.country.name}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-6 pb-4">
        <h3 className="text-[22px] leading-7 font-semibold">
          <Link href={product.href} className="after:absolute after:inset-0 hover:underline hover:decoration-2 hover:underline-offset-4">{product.title}</Link>
        </h3>
        <p className="line-clamp-3 text-sm leading-[22px] text-[#4B5563]">{product.shortDescription}</p>
      </div>
      <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4">
        <span className="inline-flex items-center gap-1 font-medium text-[#0D5380]">
          Read more<span className="sr-only"> about {product.title}</span>
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
