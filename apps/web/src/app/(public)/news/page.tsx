import type { Metadata } from "next";
import { getPosts } from "@/lib/api/public";
import { listMetadata } from "@/lib/seo/list";
import { PageHeader } from "@/components/layout/page-header";
import { PostCard } from "@/components/news/post-card";
import { Pagination } from "@/components/content/pagination";
import { StatusEmpty } from "@/components/content/status-empty";
import { PAGE_SIZES } from "@/lib/constants";
import { JsonLd } from "@/components/seo-jsonld";
import { breadcrumbList } from "@/lib/seo/jsonld";

export const metadata: Metadata = listMetadata({ title: "News", description: "Company news, product launches and field updates from Baraton Group Co.", path: "/news" });

export default async function NewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const data = await getPosts({ page, pageSize: PAGE_SIZES.news });
  return (
    <>
      <PageHeader eyebrow="Newsroom" title="News" crumbs={[{ label: "News" }]} />
      <section className="section-md bg-white">
        <div className="container-site">
          {data.data.length ? (
            <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">{data.data.map((p) => <li key={p.id}><PostCard post={p} /></li>)}</ul>
          ) : (
            <StatusEmpty title="No news yet." description="Company news will appear here once it is published." />
          )}
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} basePath="/news" params={{}} />
        </div>
      </section>
      <JsonLd data={breadcrumbList([{ label: "Home", href: "/" }, { label: "News", href: "/news" }])} />
    </>
  );
}
