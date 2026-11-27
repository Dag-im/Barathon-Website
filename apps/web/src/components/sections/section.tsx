import type { ReactNode } from "react";
import { Eyebrow } from "@/components/content/eyebrow";
import { cn } from "@/lib/utils";

/** Common section wrapper: labelled by its heading, optional eyebrow and intro. */
export function Section({
  id, title, subtitle, eyebrow, children, tone = "light", size = "lg", headingLevel = 2, className, headingAction,
}: {
  id?: string | null; title?: string | null; subtitle?: string | null; eyebrow?: string; children: ReactNode;
  tone?: "light" | "muted" | "white" | "navy"; size?: "lg" | "md" | "sm"; headingLevel?: 2 | 3; className?: string; headingAction?: ReactNode;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const bg = tone === "navy" ? "section-navy bg-[#111827] text-white" : tone === "white" ? "bg-white" : tone === "muted" ? "bg-[#EEF1F8]" : "bg-[#F8F9FA]";
  return (
    <section id={id ?? undefined} aria-labelledby={title ? headingId : undefined} className={cn("relative", bg, size === "lg" ? "section-lg" : size === "md" ? "section-md" : "section-sm", className)}>
      <div className="container-site">
        {title || eyebrow ? (
          <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[60ch]">
              {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
              {title ? <Heading id={headingId} className={cn("t-h2 mt-3", tone === "navy" ? "text-white" : "text-foreground")}>{title}</Heading> : null}
              {subtitle ? <p className={cn("mt-4 text-[17px] leading-7", tone === "navy" ? "text-[#D1D5DB]" : "text-[#374151]")}>{subtitle}</p> : null}
            </div>
            {headingAction}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
