import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, getProducts } from "@/lib/api/public";
import { ApiError } from "@/lib/api/errors";
import { PageHeader } from "@/components/layout/page-header";
import { ProductCard } from "@/components/products/product-card";
import { Pagination } from "@/components/content/pagination";
import { StatusEmpty } from "@/components/content/status-empty";
import { PAGE_SIZES } from "@/lib/constants";
import { toMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo-jsonld";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategory(slug).catch(() => null);
  if (!cat) return { title: "Category not found" };
  if (cat.seo) return toMetadata(cat.seo);
  return { title: { absolute: `${cat.name} | Products | Baraton Group Co.` }, description: cat.description ?? undefined, alternates: { canonical: `/products/category/${slug}` } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const cat = await getCategory(slug).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!cat) notFound();
  const data = await getProducts({ category: slug, page, pageSize: PAGE_SIZES.products });
  return (
    <>
      <PageHeader eyebrow="Product category" title={cat.name} intro={cat.description} crumbs={[{ label: "Products", href: "/products" }, { label: cat.name }]} />
      <section className="section-md bg-[#F8F9FA]">
        <div className="container-site">
          {data.data.length ? (
            <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
            </ul>
          ) : (
            <StatusEmpty title="No products in this category yet" action={<Link href="/products" className="underline">All products</Link>} />
          )}
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} basePath={`/products/category/${slug}`} params={{}} />
        </div>
      </section>
      {cat.seo ? <JsonLd data={cat.seo.jsonLd} /> : null}
    </>
  );
}
