"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { Plus, Pencil, Trash2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminRow } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/errors";
import { parseYoutube } from "@/lib/utils/youtube";
import { VideoPlayer } from "@/components/media/video-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusEmpty } from "@/components/content/status-empty";
import type { VideoDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type VideoForm = {
  title: string; description: string; sourceType: "YOUTUBE" | "UPLOAD"; youtubeUrl: string; mediaUrl: string; posterUrl: string;
  brandSlug: string; productSlug: string; sortOrder: number; published: boolean; isFeatured: boolean;
};

/** Admin Videos module (amendment A6): source toggle, live preview, poster, linked brand or product, order, published. */
export function VideoAdminScreen() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminRow | "new" | null>(null);
  const list = useQuery({ queryKey: ["admin", "videos"], queryFn: () => adminApi.list("videos", { pageSize: 100 }) });
  const brands = useQuery({ queryKey: ["admin", "brands", "options"], queryFn: () => adminApi.list("brands", { pageSize: 100 }) });
  const products = useQuery({ queryKey: ["admin", "products", "options"], queryFn: () => adminApi.list("products", { pageSize: 100 }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "videos"] });
  const toggle = useMutation({
    mutationFn: (r: AdminRow) => adminApi.transition("videos", r.id, r.status === "PUBLISHED" ? "unpublish" : "publish"),
    onSuccess: () => { toast.success("Updated"); invalidate(); },
    onError: () => toast.error("Could not change the published flag"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.remove("videos", id),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
  });
  const rows = list.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-8">Videos</h1>
          <p className="text-[13px] text-[#4B5563]">YouTube links or uploaded files. Both play on the site.</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus aria-hidden className="size-4" />New video</Button>
      </div>
      {rows.length === 0 && !list.isPending ? (
        <StatusEmpty title="No videos found" action={<Button size="sm" onClick={() => setEditing("new")}>Add your first video</Button>} />
      ) : (
        <div className="overflow-x-auto border border-[#E5E7EB] bg-white">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">Videos</caption>
            <thead className="bg-[#F1F3F5] text-[12px] uppercase tracking-[0.06em] text-[#4B5563]">
              <tr><th scope="col" className="h-10 px-3">Title</th><th scope="col" className="px-3">Source</th><th scope="col" className="px-3">Linked to</th><th scope="col" className="px-3">Order</th><th scope="col" className="px-3">Featured</th><th scope="col" className="px-3">Published</th><th scope="col" className="px-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = r as unknown as VideoDto & AdminRow;
                const linked = (r.brandSlug as string) || (r.productSlug as string) || "";
                return (
                  <tr key={r.id} className="border-t border-[#E5E7EB]">
                    <td className="px-3 py-2 font-medium">{String(r.title)}</td>
                    <td className="px-3 py-2">{String(r.sourceType) === "YOUTUBE" ? `YouTube ${String(r.youtubeId ?? "")}` : "Uploaded file"}</td>
                    <td className="px-3 py-2">{linked || <span className="text-[#6B7280]">None</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{String(r.sortOrder)}</td>
                    <td className="px-3 py-2">{r.isFeatured ? "Yes" : "No"}</td>
                    <td className="px-3 py-2"><span className={cn("inline-flex h-6 items-center px-2 text-xs font-medium", r.status === "PUBLISHED" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F1F3F5] text-[#374151]")}>{r.status === "PUBLISHED" ? "Published" : "Draft"}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={r.status === "PUBLISHED" ? `Unpublish ${String(r.title)}` : `Publish ${String(r.title)}`} onClick={() => toggle.mutate(r)}>{r.status === "PUBLISHED" ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}</Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${String(r.title)}`} onClick={() => setEditing(r)}><Pencil aria-hidden className="size-4" /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${String(r.title)}`} onClick={() => remove.mutate(r.id)}><Trash2 aria-hidden className="size-4 text-[#B91C1C]" /></Button>
                      </div>
                      <span className="sr-only">{v.id}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing ? (
        <VideoFormDialog
          row={editing === "new" ? null : editing}
          brands={(brands.data?.data ?? []).map((b) => ({ slug: String(b.slug), name: String(b.name) }))}
          products={(products.data?.data ?? []).map((p) => ({ slug: String(p.slug), name: String(p.title) }))}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      ) : null}
    </div>
  );
}

function VideoFormDialog({ row, brands, products, onClose, onSaved }: { row: AdminRow | null; brands: { slug: string; name: string }[]; products: { slug: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const init: VideoForm = {
    title: String(row?.title ?? ""), description: String(row?.description ?? ""),
    sourceType: (row?.sourceType as "YOUTUBE" | "UPLOAD" | undefined) ?? "YOUTUBE",
    youtubeUrl: row?.youtubeId ? `https://www.youtube.com/watch?v=${String(row.youtubeId)}${row.startSeconds ? `&t=${String(row.startSeconds)}s` : ""}` : "",
    mediaUrl: String(row?.mediaUrl ?? ""), posterUrl: String(row?.posterUrl ?? ""),
    brandSlug: String(row?.brandSlug ?? ""), productSlug: String(row?.productSlug ?? ""),
    sortOrder: Number(row?.sortOrder ?? 0), published: row?.status === "PUBLISHED", isFeatured: Boolean(row?.isFeatured),
  };
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm<VideoForm>({ defaultValues: init });
  const sourceType = useWatch({ control, name: "sourceType" });
  const youtubeUrl = useWatch({ control, name: "youtubeUrl" });
  const mediaUrl = useWatch({ control, name: "mediaUrl" });
  const posterUrl = useWatch({ control, name: "posterUrl" });
  const title = useWatch({ control, name: "title" });
  const parsed = useMemo(() => parseYoutube(youtubeUrl), [youtubeUrl]);
  const preview = sourceType === "YOUTUBE"
    ? parsed ? { title: title || "Preview", sourceType: "YOUTUBE" as const, youtubeId: parsed.youtubeId, startSeconds: parsed.startSeconds, mediaUrl: null, posterUrl: posterUrl || null, thumbnailUrl: null } : null
    : mediaUrl.startsWith("/") || mediaUrl.startsWith("http") ? { title: title || "Preview", sourceType: "UPLOAD" as const, youtubeId: null, startSeconds: null, mediaUrl, posterUrl: posterUrl || null, thumbnailUrl: null } : null;

  const save = useMutation({
    mutationFn: (v: VideoForm) => {
      const body = {
        title: v.title.trim(), description: v.description.trim() || null, sourceType: v.sourceType,
        youtubeId: v.sourceType === "YOUTUBE" ? parsed?.youtubeId ?? null : null,
        startSeconds: v.sourceType === "YOUTUBE" ? parsed?.startSeconds ?? null : null,
        mediaUrl: v.sourceType === "UPLOAD" ? v.mediaUrl.trim() : null,
        posterUrl: v.posterUrl.trim() || null,
        brandSlug: v.brandSlug || null, productSlug: v.productSlug || null,
        sortOrder: Number(v.sortOrder) || 0, isFeatured: v.isFeatured, status: v.published ? "PUBLISHED" : "DRAFT",
      };
      return row ? adminApi.update("videos", row.id, { ...body, expectedVersion: row.version }) : adminApi.create("videos", body);
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        for (const [k, msg] of Object.entries(e.fieldErrors())) setError(k as keyof VideoForm, { message: msg });
      }
      toast.error("Could not save the video");
    },
  });

  const onSubmit = (v: VideoForm) => {
    if (!v.title.trim()) return setError("title", { message: "Enter a title" });
    if (v.sourceType === "YOUTUBE" && !parsed) return setError("youtubeUrl", { message: "Enter a YouTube link (watch, youtu.be, shorts or embed)." });
    if (v.sourceType === "UPLOAD" && !v.mediaUrl.trim()) return setError("mediaUrl", { message: "Choose an uploaded video file (mp4 or webm)." });
    save.mutate(v);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>{row ? "Edit video" : "New video"}</DialogTitle>
          <DialogDescription>Choose where the video comes from. The preview shows exactly what visitors will see.</DialogDescription>
        </DialogHeader>
        <form id="video-form" noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5 md:grid-cols-2">
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm font-medium">Source</legend>
            <div role="radiogroup" className="inline-flex border border-[#878F9D]">
              {(["YOUTUBE", "UPLOAD"] as const).map((s) => (
                <label key={s} className={cn("cursor-pointer px-4 py-2 text-sm", sourceType === s ? "bg-[#2F447D] text-white" : "bg-white text-[#374151]")}>
                  <input type="radio" value={s} className="sr-only" {...register("sourceType")} />
                  {s === "YOUTUBE" ? "YouTube link" : "Upload file"}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2 grid gap-1.5">
            <Label htmlFor="v-title">Title <span className="text-[#B91C1C]">*</span></Label>
            <Input id="v-title" className="h-9" aria-invalid={Boolean(errors.title) || undefined} {...register("title")} />
            {errors.title ? <p role="alert" className="text-xs text-[#B91C1C]">{errors.title.message}</p> : null}
          </div>
          {sourceType === "YOUTUBE" ? (
            <div className="md:col-span-2 grid gap-1.5">
              <Label htmlFor="v-yt">YouTube link</Label>
              <Input id="v-yt" placeholder="https://www.youtube.com/watch?v=..." className="h-9" aria-invalid={Boolean(errors.youtubeUrl) || undefined} {...register("youtubeUrl")} />
              {errors.youtubeUrl || (youtubeUrl && !parsed) ? <p role="alert" className="flex items-center gap-1 text-xs text-[#B91C1C]"><AlertCircle aria-hidden className="size-3.5" />{errors.youtubeUrl?.message ?? "This is not a YouTube video link."}</p> : <p className="text-xs text-[#6B7280]">Watch, youtu.be, shorts and embed links are accepted; start times such as &amp;t=35s are kept.</p>}
            </div>
          ) : (
            <div className="md:col-span-2 grid gap-1.5">
              <Label htmlFor="v-media">Video file URL</Label>
              <Input id="v-media" placeholder="/media/clip.mp4 or https://media.example/clip.mp4" className="h-9" aria-invalid={Boolean(errors.mediaUrl) || undefined} {...register("mediaUrl")} />
              {errors.mediaUrl ? <p role="alert" className="text-xs text-[#B91C1C]">{errors.mediaUrl.message}</p> : <p className="text-xs text-[#6B7280]">Paste the URL of an mp4 or webm already in the media library (max 200 MB). File upload runs through the API media pipeline.</p>}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="v-poster">Poster image URL</Label>
            <Input id="v-poster" placeholder="Optional; YouTube thumbnail is used if empty" className="h-9" {...register("posterUrl")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="v-order">Order</Label>
            <Input id="v-order" type="number" className="h-9" {...register("sortOrder", { valueAsNumber: true })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="v-brand">Linked brand</Label>
            <select id="v-brand" className="h-9 border border-[#878F9D] bg-white px-2" {...register("brandSlug")}>
              <option value="">None</option>
              {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="v-product">Linked product</Label>
            <select id="v-product" className="h-9 border border-[#878F9D] bg-white px-2" {...register("productSlug")}>
              <option value="">None</option>
              {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 grid gap-1.5">
            <Label htmlFor="v-desc">Description</Label>
            <Textarea id="v-desc" rows={2} {...register("description")} />
          </div>
          <div className="flex gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#2F447D]" {...register("published")} />Published</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#2F447D]" {...register("isFeatured")} />Featured on the home page</label>
          </div>
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium">Live preview</p>
            <div className="bg-[#F1F3F5] p-3">
              {preview ? <VideoPlayer key={`${preview.sourceType}-${preview.youtubeId ?? preview.mediaUrl}`} video={preview} /> : <div className="grid aspect-video place-items-center bg-white text-sm text-[#6B7280]">Enter a valid link or file to preview</div>}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="video-form" loading={save.isPending} disabled={save.isPending}>Save video</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
