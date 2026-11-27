"use client";

import { useState } from "react";
import { VideoPlayer } from "@/components/media/video-player";
import type { VideoDto } from "@/lib/api/types";
import { youtubeThumb } from "@/lib/utils/youtube";
import { cn } from "@/lib/utils";

/** Large player with a selectable list of other videos (design 7.1 "1 + list"). */
export function FeaturedVideos({ videos }: { videos: VideoDto[] }) {
  const [selected, setSelected] = useState(0);
  const current = videos[selected] ?? videos[0];
  if (!current) return null;
  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <VideoPlayer key={current.id} video={current} />
        <h3 className="mt-4 text-xl font-semibold">{current.title}</h3>
        {current.description ? <p className="mt-2 text-[#4B5563]">{current.description}</p> : null}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1" aria-label="More videos">
        {videos.map((v, i) => (
          <li key={v.id}>
            <button
              type="button"
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              className={cn("flex w-full items-center gap-4 border border-[#E5E7EB] bg-white p-3 text-start hover:border-[#BCC8E2] focus-visible:outline-2 focus-visible:outline-offset-2", i === selected && "border-l-[3px] border-l-[#2F447D] bg-[#EEF1F8]")}
            >
              <span className="relative aspect-video w-[120px] shrink-0 overflow-hidden bg-[#111827]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.posterUrl ?? (v.youtubeId ? youtubeThumb(v.youtubeId) : "/placeholders/generic.svg")} alt="" loading="lazy" className="size-full object-cover" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-semibold leading-snug">{v.title}</span>
                <span className="text-xs text-[#6B7280]">{v.sourceType === "YOUTUBE" ? "YouTube" : "Video file"}{v.brand ? ` · ${v.brand.name}` : ""}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
