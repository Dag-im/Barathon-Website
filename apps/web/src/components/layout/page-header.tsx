import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { Eyebrow } from "@/components/content/eyebrow";
import { cn } from "@/lib/utils";

/** Page header used on every non-home route. Renders the page h1 (design 7 intro). */
export function PageHeader({ title, eyebrow, intro, crumbs, actions, className }: { title: string; eyebrow?: string; intro?: string | null; crumbs?: Crumb[]; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-[#D1D5DB] bg-[#F8F9FA]", className)}>
      {crumbs ? <Breadcrumbs items={crumbs} /> : null}
      <div className="container-site grid gap-6 pt-10 pb-8 md:pt-16 md:pb-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="t-h1 mt-3 max-w-[22ch] text-foreground">{title}</h1>
          {intro ? <p className="t-lead mt-4 max-w-[56ch] text-[#374151]">{intro}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-start gap-3 lg:col-span-4 lg:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
