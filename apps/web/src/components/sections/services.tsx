import Link from "next/link";
import { ServiceCard } from "@/components/services/service-card";
import { Section } from "./section";
import type { BlockDto } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

type Block = Extract<BlockDto, { type: "SERVICES_GRID" }>;

export function ServicesSection({ block }: { block: Block }) {
  if (!block.services.length) return null;
  return (
    <Section id="services" title={block.title ?? "Our Services"} tone="white" eyebrow="Operations">
      <ul className="grid gap-6 md:grid-cols-2">
        {block.services.map((s, i) => <li key={s.id}><ServiceCard service={s} index={i} /></li>)}
      </ul>
      {block.cta ? <div className="mt-10"><Button asChild variant="outline"><Link href={block.cta.href}>{block.cta.label}</Link></Button></div> : null}
    </Section>
  );
}
