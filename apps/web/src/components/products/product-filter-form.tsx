import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ProductListResponse } from "@/lib/api/types";

/**
 * Filter bar as a plain GET form (works without JS; filters live in the URL).
 * Filtered results are noindex (plan 5.8).
 */
export function ProductFilterForm({ facets, values, total }: { facets: ProductListResponse["facets"]; values: Record<string, string>; total: number }) {
  const active = Object.entries(values).filter(([k, v]) => v && k !== "sort");
  const selectClass = "h-11 w-full border border-[#878F9D] bg-white px-3.5 text-[16px] text-[#111827]";
  return (
    <div className="sticky top-16 z-20 -mx-4 border-y border-[#E5E7EB] bg-white/96 px-4 py-4 sm:-mx-8 sm:px-8 lg:top-20 lg:-mx-10 lg:px-10">
      <form method="get" action="/products" role="search" className="grid gap-3 md:grid-cols-12 md:items-end">
        <label className="md:col-span-3">
          <span className="mb-1.5 block text-sm font-medium">Search</span>
          <input name="q" defaultValue={values.q} placeholder="Model, part or keyword" className={selectClass} autoComplete="off" />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Country</span>
          <select name="country" defaultValue={values.country} className={selectClass}>
            <option value="">All countries</option>
            {facets.countries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.count})</option>)}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Category</span>
          <select name="category" defaultValue={values.category} className={selectClass}>
            <option value="">All categories</option>
            {facets.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.count})</option>)}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Brand</span>
          <select name="brand" defaultValue={values.brand} className={selectClass}>
            <option value="">All brands</option>
            {facets.brands.map((b) => <option key={b.slug} value={b.slug}>{b.name} ({b.count})</option>)}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Sort</span>
          <select name="sort" defaultValue={values.sort || "order"} className={selectClass}>
            <option value="order">Featured first</option>
            <option value="title">Name A to Z</option>
          </select>
        </label>
        <div className="md:col-span-1">
          <Button type="submit" className="h-11 w-full">Apply</Button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span aria-live="polite" className="text-[#4B5563]">{total} {total === 1 ? "product" : "products"}</span>
        {active.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 bg-[#E0E7FF] px-2.5 py-1 text-[#2F447D]">{k}: {v}</span>
        ))}
        {active.length ? <Link href="/products" className="ms-1 font-medium text-[#0D5380] underline underline-offset-[3px]">Clear filters</Link> : null}
      </div>
    </div>
  );
}
