import type { Metadata } from "next";
import Link from "next/link";
import { searchSite, getProducts } from "@/lib/api/public";
import { PageHeader } from "@/components/layout/page-header";
import { StatusEmpty } from "@/components/content/status-empty";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: { absolute: "Search | Baraton Group Co." }, robots: { index: false, follow: true } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const valid = q.length >= 2;
  const results = valid ? await searchSite(q).catch(() => null) : null;
  const total = results ? results.products.length + results.brands.length + results.services.length + results.posts.length + results.pages.length : 0;
  const popular = valid ? null : await getProducts({ featured: true, pageSize: 4 }).catch(() => null);
  return (
    <>
      <PageHeader eyebrow="Search" title="Search" crumbs={[{ label: "Search" }]} />
      <section className="section-md bg-[#F8F9FA]">
        <div className="container-site">
          <form method="get" action="/search" role="search" className="flex max-w-[720px] gap-3">
            <label className="sr-only" htmlFor="q">Search the site</label>
            <Input id="q" name="q" defaultValue={q} autoFocus={!q} placeholder="Search products, brands, services, news" className="h-14 text-[17px]" minLength={2} />
            <Button type="submit" size="lg" className="h-14">Search</Button>
          </form>
          {!valid ? (
            <div className="mt-12">
              <StatusEmpty title="Search the catalogue" description="Type at least two characters: a machine model, a brand or a service." />
              {popular?.data.length ? (
                <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{popular.data.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ul>
              ) : null}
            </div>
          ) : results && total > 0 ? (
            <div className="mt-12 space-y-12">
              <p className="text-[#374151]" aria-live="polite">{total} results for &lsquo;{q}&rsquo;</p>
              {results.products.length ? (
                <div><h2 className="eyebrow mb-4">Products ({results.products.length})</h2><ul className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">{results.products.map((p) => <li key={p.id} className="py-4"><Link href={p.href} className="text-lg font-semibold hover:underline">{p.title}</Link><p className="text-sm text-[#4B5563] line-clamp-2">{p.shortDescription}</p></li>)}</ul></div>
              ) : null}
              {results.brands.length ? (
                <div><h2 className="eyebrow mb-4">Brands ({results.brands.length})</h2><ul className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">{results.brands.map((b) => <li key={b.id} className="py-4"><Link href={b.href} className="text-lg font-semibold hover:underline">{b.name}</Link></li>)}</ul></div>
              ) : null}
              {results.services.length ? (
                <div><h2 className="eyebrow mb-4">Services ({results.services.length})</h2><ul className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">{results.services.map((s) => <li key={s.id} className="py-4"><Link href={s.href} className="text-lg font-semibold hover:underline">{s.title}</Link></li>)}</ul></div>
              ) : null}
            </div>
          ) : (
            <div className="mt-12">
              <StatusEmpty title={`No results for '${q}'`} description="Try a product model, a brand name or a shorter term." action={<Button asChild variant="outline"><Link href="/contact">Contact us</Link></Button>} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
