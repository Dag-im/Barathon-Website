"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Block = { id: string; type: string; title?: string; subtitle?: string; visible?: boolean; [k: string]: unknown };

const LABELS: Record<string, string> = {
  HERO_CAROUSEL: "Hero carousel", BRANDS_MARQUEE: "Brands marquee", IMAGE_TEXT: "Image and text", STATS: "Stats",
  FEATURED_PRODUCTS: "Featured products", SERVICES_GRID: "Services", VIDEOS_GRID: "Featured videos", CTA_BANNER: "Call to action",
  TIMELINE: "Timeline", LEADER_MESSAGE: "Leader message", MISSION_VISION: "Mission and vision", CORE_VALUES: "Core values",
  SUBSIDIARIES: "Subsidiaries", FAQ: "FAQ", TESTIMONIALS: "Testimonials", LATEST_POSTS: "Latest news", BRAND_GRID: "Brand grid", RICH_TEXT: "Rich text",
};

/**
 * Ordered block editor for the home and about pages (plan 8.7 / backend 6.3.3).
 * Reorder with the arrow buttons (keyboard-friendly), toggle visibility, edit the
 * heading texts and save the whole list atomically with PUT.
 */
export function BlocksEditor({ pageKey, title }: { pageKey: "home" | "about"; title: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "page", pageKey], queryFn: () => adminApi.byKey(pageKey) });
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (q.data) {
      setBlocks((q.data.blocks as Block[]).map((b) => ({ ...b, visible: b.visible ?? true })));
      setDirty(false);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => adminApi.saveBlocks(String(q.data?.id), blocks),
    onSuccess: () => { toast.success("Layout saved. The public page refreshes within a minute."); setDirty(false); qc.invalidateQueries({ queryKey: ["admin", "page", pageKey] }); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save the layout"),
  });

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setBlocks(next);
    setDirty(true);
  };
  const patch = (i: number, p: Partial<Block>) => {
    setBlocks((bs) => bs.map((b, k) => (k === i ? { ...b, ...p } : b)));
    setDirty(true);
  };
  const remove = (i: number) => {
    setBlocks((bs) => bs.filter((_, k) => k !== i));
    setDirty(true);
  };

  if (q.isPending) return <div className="h-40 animate-pulse bg-[#E5E7EB]" aria-busy="true" />;
  if (q.isError) return <div role="alert" className="border border-[#FCA5A5] bg-[#FEE2E2] p-4 text-[#991B1B]">Could not load the page layout.</div>;
  const enabledCount = blocks.filter((b) => b.visible).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-8">{title}</h1>
          <p className="text-[13px] text-[#4B5563]">{blocks.length} sections, {enabledCount} visible. Order here is the order on the site.</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} loading={save.isPending}><Save aria-hidden className="size-4" />Save layout</Button>
      </div>
      {enabledCount === 0 ? <p role="alert" className="text-[#92400E]">At least one section must be visible.</p> : null}
      <ol className="space-y-3">
        {blocks.map((b, i) => (
          <li key={b.id}>
            <Card className="rounded-none shadow-none">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 py-3">
                <CardTitle className="text-base">{i + 1}. {LABELS[b.type] ?? b.type}</CardTitle>
                <div className="flex items-center gap-1">
                  <label className="me-2 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#2F447D]" checked={Boolean(b.visible)} onChange={(e) => patch(i, { visible: e.target.checked })} />Visible</label>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${LABELS[b.type] ?? b.type} up`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp aria-hidden className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${LABELS[b.type] ?? b.type} down`} onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><ArrowDown aria-hidden className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${LABELS[b.type] ?? b.type}`} onClick={() => remove(i)}><Trash2 aria-hidden className="size-4 text-[#B91C1C]" /></Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 pb-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`bt-${b.id}`}>Heading</Label>
                  <Input id={`bt-${b.id}`} className="h-9" value={b.title ?? ""} onChange={(e) => patch(i, { title: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`bs-${b.id}`}>Subheading</Label>
                  <Input id={`bs-${b.id}`} className="h-9" value={b.subtitle ?? ""} onChange={(e) => patch(i, { subtitle: e.target.value })} />
                </div>
                <p className="text-xs text-[#6B7280] md:col-span-2">Content for this section (products, brands, videos, slides) comes from the module it links to. Edit those in their own screens.</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
