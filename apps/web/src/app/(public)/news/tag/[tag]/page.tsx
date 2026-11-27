import type { Metadata } from "next";
import { getPosts } from "@/lib/api/public";
import { listMetadata } from "@/lib/seo/list";
import { PageHeader } from "@/components/layout/page-header";
import { PostCard } from "@/components/news/post-card";
import { StatusEmpty } from "@/components/content/status-empty";

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return listMetadata({ title: `News tagged ${tag.replace(/-/g, " ")}`, path: `/news/tag/${tag}` });
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const data = await getPosts({ tag });
  return (
    <>
      <PageHeader eyebrow="News" title={`Tagged: ${tag.replace(/-/g, " ")}`} crumbs={[{ label: "News", href: "/news" }, { label: tag.replace(/-/g, " ") }]} />
      <section className="section-md bg-white"><div className="container-site">
        {data.data.length ? <ul className="grid gap-8 md:grid-cols-3">{data.data.map((p) => <li key={p.id}><PostCard post={p} /></li>)}</ul> : <StatusEmpty title="No news with this tag" />}
      </div></section>
    </>
  );
}
