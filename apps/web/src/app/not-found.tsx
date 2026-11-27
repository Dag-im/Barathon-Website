import Link from "next/link";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveRedirect, getProducts } from "@/lib/api/public";
import { ProductCard } from "@/components/products/product-card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Page not found | Baraton Group Co." }, robots: { index: false, follow: true } };

/**
 * Branded 404 (design 7.14). Before rendering, the path is looked up in the
 * CMS redirect table so redirects created in the admin work without a deploy.
 */
export default async function NotFound() {
  const h = await headers();
  const path = h.get("x-pathname");
  if (path && path !== "/") {
    const hit = await resolveRedirect(path).catch(() => null);
    if (hit && hit.match) permanentRedirect(hit.target);
  }
  const popular = await getProducts({ featured: true, pageSize: 4 }).catch(() => null);
  return (
    <section className="section-lg bg-[#F8F9FA] text-center">
      <div className="container-prose flex flex-col items-center gap-6 px-4">
        <p className="font-display text-[120px] leading-none font-bold text-[#2F447D] sm:text-[160px]" aria-hidden>404</p>
        <h1 className="t-h1 text-foreground">Page not found</h1>
        <p className="t-lead max-w-[46ch] text-[#374151]">The page may have moved or never existed. Try search, or go to one of these sections.</p>
        <form method="get" action="/search" role="search" className="flex w-full max-w-[480px] gap-2">
          <label className="sr-only" htmlFor="nf-q">Search the site</label>
          <Input id="nf-q" name="q" placeholder="Search products, brands, services" className="h-14" minLength={2} />
          <Button type="submit" size="lg" className="h-14"><Search aria-hidden className="size-5" /><span className="sr-only">Search</span></Button>
        </form>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline"><Link href="/">Home</Link></Button>
          <Button asChild variant="outline"><Link href="/products">Products</Link></Button>
          <Button asChild variant="outline"><Link href="/brands">Brands</Link></Button>
          <Button asChild variant="outline"><Link href="/contact">Contact</Link></Button>
        </div>
      </div>
      {popular?.data.length ? (
        <div className="container-site mt-20 text-start">
          <h2 className="eyebrow mb-6">Popular products</h2>
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{popular.data.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}
