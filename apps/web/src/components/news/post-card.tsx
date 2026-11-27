import Link from "next/link";
import type { PostCardDto } from "@/lib/api/types";
import { CmsImage } from "@/components/media/cms-image";
import { formatDate } from "@/lib/utils/format";

export function PostCard({ post }: { post: PostCardDto }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[16/10] overflow-hidden border border-[#E5E7EB] bg-white">
        <CmsImage media={post.cover} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" caption={post.title} />
      </div>
      <h3 className="mt-4 text-[22px] leading-7 font-semibold"><Link href={post.href} className="after:absolute after:inset-0 hover:underline">{post.title}</Link></h3>
      <p className="mt-2 line-clamp-2 text-sm text-[#4B5563]">{post.excerpt}</p>
      <p className="mt-3 flex items-center gap-3 text-xs text-[#4B5563]">
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        <span aria-hidden className="h-3 w-px bg-[#D1D5DB]" />
        <span>{post.readingMinutes} min read</span>
      </p>
    </article>
  );
}
