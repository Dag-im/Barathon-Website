import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RichHtml } from "@/components/content/rich-html";
import { PostCard } from "@/components/news/post-card";
import { BrandCard } from "@/components/brands/brand-card";
import { Section } from "./section";
import { StatusEmpty } from "@/components/content/status-empty";
import type { BlockDto } from "@/lib/api/types";

type Of<T extends BlockDto["type"]> = Extract<BlockDto, { type: T }>;

export function FaqSection({ block }: { block: Of<"FAQ"> }) {
  const groups = block.groups.filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <Section id="faq" title="Frequently asked questions" tone="white" size="md">
      {groups.map((g) => (
        <div key={g.id} className="mb-10 last:mb-0">
          <h3 className="mb-2 text-xl font-semibold">{g.title}</h3>
          <Accordion type="multiple">
            {g.items.map((it) => (
              <AccordionItem key={it.id} value={it.id} id={`q-${it.id}`}>
                <AccordionTrigger className="font-display text-xl font-semibold">{it.question}</AccordionTrigger>
                <AccordionContent><RichHtml html={it.answerHtml} className="max-w-[68ch] pb-6 text-[#374151]" /></AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </Section>
  );
}

export function TestimonialsSection({ block }: { block: Of<"TESTIMONIALS"> }) {
  const t = block.testimonials[0];
  if (!t) return null;
  return (
    <Section id="testimonials" title="What customers say" tone="muted">
      <figure className="relative max-w-[60ch] border-l-[3px] border-[#843C40] ps-8">
        <blockquote className="font-display text-[26px] leading-[38px] font-medium">&ldquo;{t.quote}&rdquo;</blockquote>
        <figcaption className="mt-6 text-sm text-[#374151]">{t.personName}{t.personRole ? `, ${t.personRole}` : ""}{t.companyName ? ` · ${t.companyName}` : ""}</figcaption>
      </figure>
    </Section>
  );
}

export function LatestPostsSection({ block }: { block: Of<"LATEST_POSTS"> }) {
  if (!block.posts.length) return null;
  return (
    <Section id="news" title="News" tone="white" headingAction={<Link href="/news" className="font-medium text-[#0D5380] underline underline-offset-[3px]">All news</Link>}>
      <ul className="grid gap-8 md:grid-cols-3">{block.posts.map((p) => <li key={p.id}><PostCard post={p} /></li>)}</ul>
    </Section>
  );
}

export function BrandGridSection({ block }: { block: Of<"BRAND_GRID"> }) {
  if (!block.brands.length) return null;
  return (
    <Section id="brands-grid" title="Brands" tone="light">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{block.brands.map((b) => <li key={b.id}><BrandCard brand={b} /></li>)}</ul>
    </Section>
  );
}

export function RichTextSection({ block }: { block: Of<"RICH_TEXT"> }) {
  if (!block.html.trim()) return <StatusEmpty title="No content yet" />;
  return (
    <Section id={block.anchorId ?? undefined} tone="light" size="md" title={block.title ?? undefined}>
      <div className="container-prose px-0"><RichHtml html={block.html} /></div>
    </Section>
  );
}
