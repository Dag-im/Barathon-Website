import Link from "next/link";
import { CmsImage } from "@/components/media/cms-image";
import { RichHtml } from "@/components/content/rich-html";
import { Button } from "@/components/ui/button";
import type { BlockDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Block = Extract<BlockDto, { type: "IMAGE_TEXT" }>;

/** Company story style block (design 7.1 section 3): navy band with optional plate image and CTAs. */
export function ImageTextSection({ block }: { block: Block }) {
  const hasImage = Boolean(block.image) || block.imagePosition === "TOP";
  return (
    <section aria-labelledby={block.heading ? `${block.id}-h` : undefined} className="section-navy relative overflow-hidden bg-[#111827] text-white section-lg">
      <div className="container-site grid gap-12 lg:grid-cols-12">
        <div className={cn("lg:col-span-5", block.imagePosition === "RIGHT" && "lg:order-2")}>
          <div className="relative">
            <div className="plate aspect-[4/3] bg-white" />
            <div className="relative aspect-[4/3] overflow-hidden bg-white p-12">
              <CmsImage media={block.image} sizes="(min-width:1024px) 40vw, 100vw" fit="contain" variant="logo" caption="BARATON GROUP CO." />
            </div>
          </div>
          {!hasImage ? null : null}
        </div>
        <div className={cn("lg:col-span-6 lg:col-start-7", block.imagePosition === "RIGHT" && "lg:order-1 lg:col-start-1")}>
          {block.heading ? <h2 id={`${block.id}-h`} className="t-h2 text-white">{block.heading}</h2> : null}
          <div className="mt-6 max-w-[60ch] text-[18px] leading-[30px] text-[#D1D5DB] [&_p+p]:mt-6">
            <RichHtml html={block.bodyHtml} className="text-[#D1D5DB] [&_a]:text-[#60A5FA] [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white" />
          </div>
          {block.buttons.length ? (
            <div className="mt-10 flex flex-wrap gap-3">
              {block.buttons.map((b) => (
                <Button key={b.label} asChild variant={b.variant === "PRIMARY" ? "primary" : "outline"} size="lg" className={b.variant === "PRIMARY" ? "section-navy:bg-white" : "border-white/24 text-white hover:bg-white/8"}>
                  <Link href={b.href} target={b.target === "BLANK" ? "_blank" : undefined} rel={b.target === "BLANK" ? "noopener noreferrer" : undefined}>{b.label}</Link>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
