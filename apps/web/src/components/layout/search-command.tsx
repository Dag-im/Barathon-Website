"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { apiRequest } from "@/lib/api/client";
import type { BrandCardDto, PostCardDto, ProductCardDto, ServiceCardDto } from "@/lib/api/types";
import { Kbd } from "@/components/content/kbd";

type Hits = { products: ProductCardDto[]; brands: BrandCardDto[]; services: ServiceCardDto[]; posts: PostCardDto[] };
const RECENT_KEY = "bt.recentSearches";

/** Global search palette (plan 7.2 SearchCommand). Opened by the header trigger, "/" or Ctrl/Cmd+K. */
export function SearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hits | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[]);
    } catch {
      setRecent([]);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      apiRequest<Hits>("/public/search", { query: { q: q.trim(), limit: 5 }, cache: "no-store" })
        .then((r) => !ctl.signal.aborted && setHits(r))
        .catch(() => !ctl.signal.aborted && setHits(null));
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const go = (href: string, label?: string) => {
    if (label) {
      try {
        const next = [label, ...recent.filter((r) => r !== label)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: skip recents */
      }
    }
    onOpenChange(false);
    router.push(href);
  };

  const submitAll = () => q.trim().length >= 2 && go(`/search?q=${encodeURIComponent(q.trim())}`, q.trim());
  const empty = q.trim().length >= 2 && hits && !hits.products.length && !hits.brands.length && !hits.services.length && !hits.posts.length;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Search products, brands, services and news" className="sm:max-w-[640px] rounded-md">
      <CommandInput placeholder="Search products, brands, services..." value={q} onValueChange={setQ} onKeyDown={(e) => e.key === "Enter" && !e.defaultPrevented && submitAll()} />
      <CommandList className="max-h-[420px]">
        {q.trim().length < 2 && recent.length > 0 ? (
          <CommandGroup heading="Recent searches">
            {recent.map((r) => (
              <CommandItem key={r} value={`recent ${r}`} onSelect={() => go(`/search?q=${encodeURIComponent(r)}`)}>
                <Clock aria-hidden className="size-4 text-[#4B5563]" /> {r}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {hits?.products.length ? (
          <CommandGroup heading="Products">
            {hits.products.map((p) => (
              <CommandItem key={p.id} value={`product ${p.title}`} onSelect={() => go(p.href, q)}>
                <span className="flex-1 truncate">{p.title}</span>
                <span className="text-xs text-[#6B7280]">{p.country.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {hits?.brands.length ? (
          <CommandGroup heading="Brands">
            {hits.brands.map((b) => (
              <CommandItem key={b.id} value={`brand ${b.name}`} onSelect={() => go(b.href, q)}>
                <span className="flex-1 truncate">{b.name}</span>
                <span className="text-xs text-[#6B7280]">{b.country.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {hits?.services.length ? (
          <CommandGroup heading="Services">
            {hits.services.map((s) => (
              <CommandItem key={s.id} value={`service ${s.title}`} onSelect={() => go(s.href, q)}>
                <span className="flex-1 truncate">{s.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {hits?.posts.length ? (
          <CommandGroup heading="News">
            {hits.posts.map((n) => (
              <CommandItem key={n.id} value={`news ${n.title}`} onSelect={() => go(n.href, q)}>
                <span className="flex-1 truncate">{n.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {empty ? <CommandEmpty>{`No matches for '${q}'. Try a product or brand name.`}</CommandEmpty> : null}
        {q.trim().length >= 2 ? (
          <>
            <CommandSeparator />
            <CommandItem value="see-all" onSelect={submitAll}>
              <Search aria-hidden className="size-4" /> See all results for &lsquo;{q.trim()}&rsquo;
            </CommandItem>
          </>
        ) : null}
      </CommandList>
      <div className="flex items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-2 text-xs text-[#4B5563]">
        <span className="flex items-center gap-2"><Kbd>Enter</Kbd> to open</span>
        <span className="flex items-center gap-2"><Kbd>Esc</Kbd> to close</span>
      </div>
    </CommandDialog>
  );
}
