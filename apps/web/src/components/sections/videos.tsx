import type { BlockDto } from "@/lib/api/types";
import { Section } from "./section";
import { FeaturedVideos } from "./featured-videos";

type Block = Extract<BlockDto, { type: "VIDEOS_GRID" }>;

/** Featured Videos (design 7.1 section 7): one large player plus a list; both play on the site (A6). */
export function VideosSection({ block }: { block: Block }) {
  if (!block.videos.length) return null;
  return (
    <Section id="videos" title={block.title ?? "Featured Videos"} subtitle={block.subtitle ?? undefined} tone="light">
      <FeaturedVideos videos={block.videos} />
    </Section>
  );
}
