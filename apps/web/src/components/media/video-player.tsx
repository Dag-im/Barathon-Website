"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { VideoDto } from "@/lib/api/types";
import { youtubeEmbed, youtubeThumb } from "@/lib/utils/youtube";
import { cn } from "@/lib/utils";

/**
 * Plays a video inside the page (amendment A6).
 * YOUTUBE: poster facade; the youtube-nocookie iframe loads only after click.
 * UPLOAD: native <video controls preload="metadata"> with the poster.
 */
export function VideoPlayer({ video, className, autoStart = false }: { video: Pick<VideoDto, "title" | "sourceType" | "youtubeId" | "startSeconds" | "mediaUrl" | "posterUrl" | "thumbnailUrl">; className?: string; autoStart?: boolean }) {
  const [playing, setPlaying] = useState(autoStart);
  const frame = cn("relative aspect-video w-full overflow-hidden bg-[#111827]", className);

  if (video.sourceType === "UPLOAD") {
    if (!video.mediaUrl) return <div className={frame} />;
    return (
      <div className={frame}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions are supplied per upload when available */}
        <video
          className="size-full bg-black object-contain"
          controls
          preload="metadata"
          src={video.mediaUrl}
          poster={video.posterUrl ?? undefined}
          aria-label={`Video: ${video.title}`}
          playsInline
        >
          Your browser cannot play this video. <a href={video.mediaUrl} className="underline">Download the file</a>.
        </video>
      </div>
    );
  }

  if (!video.youtubeId) return <div className={frame} />;
  const poster = video.posterUrl ?? video.thumbnailUrl ?? youtubeThumb(video.youtubeId);

  if (playing) {
    return (
      <div className={frame}>
        <iframe
          className="absolute inset-0 size-full"
          src={youtubeEmbed(video.youtubeId, video.startSeconds, true)}
          title={video.title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className={frame}>
      {/* Poster facade: no request to YouTube until the viewer presses play. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-[#111827]/25" aria-hidden />
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="group absolute inset-0 grid place-items-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#60A5FA]"
        aria-label={`Play video: ${video.title}`}
      >
        <span className="grid size-[72px] place-items-center rounded bg-white/95 text-[#2F447D] transition-colors duration-150 group-hover:bg-[#2F447D] group-hover:text-white">
          <Play aria-hidden className="size-7 fill-current" />
        </span>
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#111827]/90 to-transparent p-4 text-white">
        <p className="font-display text-base font-semibold leading-snug">{video.title}</p>
        <p className="text-xs text-[#D1D5DB]">YouTube</p>
      </div>
    </div>
  );
}
