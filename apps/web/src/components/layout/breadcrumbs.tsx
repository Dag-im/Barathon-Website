import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { breadcrumbList } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo-jsonld";

export type Crumb = { label: string; href?: string };

/** Visible breadcrumb, mirrored by BreadcrumbList JSON-LD (plan 5.10). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
      <div className="container-site">
        <ol className="flex h-12 flex-wrap items-center gap-2 text-sm text-[#4B5563]">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="flex items-center gap-2" aria-current={last ? "page" : undefined}>
                {i > 0 ? <ChevronRight aria-hidden className="size-3.5 text-[#9CA3AF]" /> : null}
                {c.href && !last ? (
                  <Link href={c.href} className="hover:text-[#2F447D] hover:underline">{c.label}</Link>
                ) : (
                  <span className={last ? "font-medium text-[#111827]" : undefined}>{c.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <JsonLd data={breadcrumbList(all)} />
    </nav>
  );
}
