import { VideoPlayer } from "@/components/media/video-player";
import type { VideoDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Renders sanitised HTML from the API. Video embeds are shortcode paragraphs
 * (amendment A6, rich-text video block):
 *   <p>[video:AJSPVh_fCoY]</p>          YouTube by 11-character id
 *   <p>[upload:/media/clip.mp4]</p>     uploaded file (native player)
 */
const TOKEN = /<p>\s*\[(video|upload):([^\]]+)\]\s*<\/p>/g;

export function RichHtml({ html, className }: { html: string; className?: string }) {
  const parts: ({ kind: "html"; html: string } | { kind: "video"; video: Pick<VideoDto, "title" | "sourceType" | "youtubeId" | "mediaUrl" | "posterUrl" | "thumbnailUrl" | "startSeconds"> })[] = [];
  let last = 0;
  for (const m of html.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ kind: "html", html: html.slice(last, idx) });
    const value = (m[2] ?? "").trim();
    if (m[1] === "video" && /^[A-Za-z0-9_-]{11}$/.test(value)) {
      parts.push({ kind: "video", video: { title: "Video", sourceType: "YOUTUBE", youtubeId: value, mediaUrl: null, posterUrl: null, thumbnailUrl: null, startSeconds: null } });
    } else if (m[1] === "upload" && value.startsWith("/")) {
      parts.push({ kind: "video", video: { title: "Video", sourceType: "UPLOAD", youtubeId: null, mediaUrl: value, posterUrl: null, thumbnailUrl: null, startSeconds: null } });
    }
    last = idx + m[0].length;
  }
  if (last < html.length) parts.push({ kind: "html", html: html.slice(last) });
  return (
    <div className={cn("prose-site", className)}>
      {parts.map((p, i) =>
        p.kind === "html" ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: p.html }} />
        ) : (
          <figure key={i} className="my-8">
            <VideoPlayer video={{ ...p.video, title: p.video.title }} />
          </figure>
        ),
      )}
    </div>
  );
}
