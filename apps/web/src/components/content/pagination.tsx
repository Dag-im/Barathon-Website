import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Anchor-based pagination (plan 5.8): real links, other query params preserved. */
export function Pagination({ page, totalPages, total, pageSize, basePath, params }: { page: number; totalPages: number; total: number; pageSize: number; basePath: string; params: Record<string, string> }) {
  if (totalPages <= 1) return null;
  const href = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "sort") sp.set(k, v);
    else if (v && k === "sort" && v !== "order") sp.set(k, v);
    if (n > 1) sp.set("page", String(n));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const item = "inline-flex size-11 items-center justify-center text-[15px] text-[#374151] hover:bg-[#EEF1F8]";
  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <ol className="flex flex-wrap items-center gap-1">
        <li>{page > 1 ? <Link href={href(page - 1)} rel="prev" className={cn(item, "w-auto gap-1 px-3")}><ChevronLeft aria-hidden className="size-4" /><span className="hidden sm:inline">Previous</span></Link> : <span className="inline-flex h-11 items-center px-3 opacity-50"><ChevronLeft aria-hidden className="size-4" /></span>}</li>
        {nums.map((n, i) => (
          <li key={`${n}-${i}`}>
            {n === "…" ? <span className="inline-flex size-11 items-center justify-center text-[#6B7280]">&hellip;</span> : (
              <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={cn(item, n === page && "bg-[#2F447D] text-white hover:bg-[#3A5188]")}>
                <span className="sr-only">Page </span>{n}
              </Link>
            )}
          </li>
        ))}
        <li>{page < totalPages ? <Link href={href(page + 1)} rel="next" className={cn(item, "w-auto gap-1 px-3")}><span className="hidden sm:inline">Next</span><ChevronRight aria-hidden className="size-4" /></Link> : <span className="inline-flex h-11 items-center px-3 opacity-50"><ChevronRight aria-hidden className="size-4" /></span>}</li>
      </ol>
      <p className="text-sm text-[#4B5563]">Showing {from}&ndash;{to} of {total}</p>
    </nav>
  );
}
