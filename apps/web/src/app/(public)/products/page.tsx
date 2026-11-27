import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProducts } from "@/lib/api/public";
import { listMetadata } from "@/lib/seo/list";
import { PageHeader } from "@/components/layout/page-header";
import { ProductCard } from "@/components/products/product-card";
import { ProductFilterForm } from "@/components/products/product-filter-form";
import { Pagination } from "@/components/content/pagination";
import { StatusEmpty } from "@/components/content/status-empty";
import { Button } from "@/components/ui/button";
import { PAGE_SIZES } from "@/lib/constants";
import { ApiError } from "@/lib/api/errors";
import { JsonLd } from "@/components/seo-jsonld";
import { breadcrumbList } from "@/lib/seo/jsonld";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const filtered = ["q", "country", "category", "brand", "sort"].some((k) => one(sp[k]));
  return listMetadata({
    title: "Products",
    description: "Rock drills, air compressors, crushers and concrete mixing equipment from the principal brands we represent in Ethiopia.",
    path: "/products",
    page,
    filtered,
  });
}

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q);
  const country = one(sp.country);
  const category = one(sp.category);
  const brand = one(sp.brand);
  const sort = one(sp.sort) || "order";
  const data = await getProducts({ q, country, category, brand, sort, page, pageSize: PAGE_SIZES.products }).catch((e) => {
    if (e instanceof ApiError && e.status === 400) return null;
    throw e;
  });
  if (!data) notFound();
  const { facets, meta } = data;
  const hasFilter = Boolean(q || country || category || brand);

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        intro="Genuine machines and equipment from the principals we represent. Request a quote for any line; we confirm availability and lead time."
        crumbs={[{ label: "Products" }]}
        actions={<p className="font-display text-[44px] leading-none font-bold text-[#2F447D]" aria-hidden>{meta.total}<span className="ms-2 text-base font-semibold text-[#4B5563]">product lines</span></p>}
      />
      <section aria-label="Product results" className="section-md bg-[#F8F9FA]">
        <div className="container-site">
          <ProductFilterForm facets={facets} values={{ q, country, category, brand, sort }} total={meta.total} />
          {data.data.length ? (
            <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((p, i) => <li key={p.id}><ProductCard product={p} priority={i === 0 && page === 1} /></li>)}
            </ul>
          ) : (
            <StatusEmpty title="No products match these filters" description="Try another country or category, or send us the make and part number." action={<div className="flex flex-wrap justify-center gap-3"><Button asChild variant="outline"><Link href="/products">Clear filters</Link></Button><Button asChild><Link href="/contact?subject=quote">Request a quote</Link></Button></div>} />
          )}
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} basePath="/products" params={{ q, country, category, brand, sort }} />
          {hasFilter ? null : (
            <div className="mt-16 flex flex-col gap-4 border border-[#BCC8E2] bg-[#EEF1F8] p-8 md:flex-row md:items-center md:justify-between">
              <p className="max-w-[56ch] text-[#25376A]">Can&rsquo;t find the model or part you need? Send us the make and part number.</p>
              <Button asChild><Link href="/contact?subject=quote">Request a quote</Link></Button>
            </div>
          )}
        </div>
      </section>
      <JsonLd data={breadcrumbList([{ label: "Home", href: "/" }, { label: "Products", href: "/products" }])} />
    </>
  );
}
