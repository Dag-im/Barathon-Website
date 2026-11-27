import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/api/public";
import { ApiError } from "@/lib/api/errors";
import { toMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CmsImage } from "@/components/media/cms-image";
import { RichHtml } from "@/components/content/rich-html";
import { PostCard } from "@/components/news/post-card";
import { ShareButton } from "@/components/content/share-button";
import { formatDate } from "@/lib/utils/format";
import { JsonLd } from "@/components/seo-jsonld";
import { absoluteUrl } from "@/lib/seo/urls";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPost(slug).catch(() => null);
  return p ? toMetadata(p.seo) : { title: "Article not found" };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const p = await getPost(slug).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!p) notFound();
  return (
    <>
      <Breadcrumbs items={[{ label: "News", href: "/news" }, { label: p.title }]} />
      <article className="section-md">
        <header className="container-prose px-4">
          <div className="flex flex-wrap gap-2">{p.tags.map((t) => <Link key={t.slug} href={`/news/tag/${t.slug}`} className="bg-[#EEF1F8] px-2.5 py-1 text-[13px] text-[#25376A]">{t.name}</Link>)}</div>
          <h1 className="t-h1 mt-5 text-foreground">{p.title}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#4B5563]">
            {p.authorName ? <span>{p.authorName}</span> : null}
            <time dateTime={p.publishedAt}>{formatDate(p.publishedAt)}</time>
            <span>{p.readingMinutes} min read</span>
            <ShareButton url={absoluteUrl(`/news/${p.slug}`)} title={p.title} variant="outline" label="Share" />
          </p>
        </header>
        {p.cover ? <div className="container-site mt-10 aspect-[21/9] overflow-hidden"><CmsImage media={p.cover} sizes="100vw" priority caption={p.title} /></div> : null}
        <div className="container-prose mt-10 px-4"><RichHtml html={p.bodyHtml} /></div>
      </article>
      {p.related.length ? (
        <section className="section-md bg-white"><div className="container-site"><h2 className="t-h2 mb-10">Related news</h2><ul className="grid gap-8 md:grid-cols-3">{p.related.slice(0, 3).map((r) => <li key={r.id}><PostCard post={r} /></li>)}</ul></div></section>
      ) : null}
      <JsonLd data={p.seo.jsonLd} />
    </>
  );
}
