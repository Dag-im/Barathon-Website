"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MenuItemDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Header item with children: a disclosure button and a panel. Hover-intent
 * (120 ms open / 200 ms close), click, Enter/Space and Esc are supported.
 */
export function MegaMenu({ item, active }: { item: MenuItemDto; active: boolean }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const schedule = (v: boolean, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(v), delay);
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrap} className="relative" onMouseEnter={() => schedule(true, 120)} onMouseLeave={() => schedule(false, 200)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`mega-${item.id}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-11 items-center gap-1 font-display text-[16px] font-medium text-foreground hover:text-[#2F447D]",
          "border-b-2 border-transparent transition-colors",
          active && "font-semibold text-[#111827] border-[#843C40]",
        )}
      >
        {item.label}
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={`mega-${item.id}`}
        hidden={!open}
        className="absolute start-0 top-full z-50 mt-1 w-[min(640px,90vw)] border border-[#E5E7EB] bg-white p-6 shadow-md"
      >
        <p className="eyebrow">Categories</p>
        <ul className="mt-4 grid gap-1 sm:grid-cols-2">
          {item.children.map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="block py-2 text-[15px] text-[#111827] hover:text-[#2F447D] hover:underline" onClick={() => setOpen(false)}>
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
        {item.viewAll ? (
          <div className="mt-4 border-t border-[#E5E7EB] pt-4">
            <Link href={item.viewAll.href} className="text-[#0D5380] underline underline-offset-[3px]" onClick={() => setOpen(false)}>
              {item.viewAll.label}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
