"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Sticky in-page navigation with the active section highlighted (IntersectionObserver). */
export function ProductTocNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <ul className="sticky top-32 flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:border-s lg:border-[#E5E7EB]">
      {items.map((i) => (
        <li key={i.id}>
          <a href={`#${i.id}`} aria-current={active === i.id ? "location" : undefined} className={cn("block border-b-2 border-transparent px-3 py-2 text-sm text-[#4B5563] hover:text-[#111827] lg:border-b-0 lg:border-s-2 lg:-ms-px", active === i.id && "border-[#2F447D] font-medium text-[#111827] lg:border-s-2")}>
            {i.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
