"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { CmsImage } from "@/components/media/cms-image";
import { StatusEmpty } from "@/components/content/status-empty";
import { AlertTriangle } from "lucide-react";

/** Media library (plan 8.12): grid of stored assets with alt-text status. Upload uses the API presign flow (not in this build). */
export default function MediaPage() {
  const q = useQuery({ queryKey: ["admin", "media"], queryFn: () => adminApi.media() });
  const items = q.data?.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-8">Media library</h1>
          <p className="text-[13px] text-[#4B5563]">{items.length} files. Images need alt text unless marked decorative.</p>
        </div>
      </div>
      {items.length === 0 && !q.isPending ? <StatusEmpty title="No media yet" description="Upload files through the media pipeline once the API storage is connected." /> : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {items.map((m) => (
            <li key={m.id} className="border border-[#E5E7EB] bg-white">
              <div className="relative aspect-[4/3] bg-[#F1F3F5]"><CmsImage media={m} sizes="200px" /></div>
              <div className="p-2 text-xs">
                <p className="truncate">{m.alt || "No alt text"}</p>
                {!m.alt ? <p className="mt-1 inline-flex items-center gap-1 text-[#92400E]"><AlertTriangle aria-hidden className="size-3" />Needs alt text</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
