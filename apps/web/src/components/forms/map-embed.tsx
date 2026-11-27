"use client";

import { useState } from "react";
import { MapPin, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteDto } from "@/lib/api/types";

/** Map facade (design 6.17): nothing loads from Google until "Load map" is pressed. */
export function MapEmbed({ offices }: { offices: SiteDto["offices"] }) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const office = offices[active];
  if (!office) return null;
  const query = encodeURIComponent([office.name, ...office.lines].join(", "));
  const embed = `https://maps.google.com/maps?q=${query}&output=embed`;
  const directions = `https://www.google.com/maps/search/?api=1&query=${query}`;
  return (
    <div>
      {offices.length > 1 ? (
        <div role="tablist" className="mb-4 flex flex-wrap gap-2" aria-label="Offices">
          {offices.map((o, i) => (
            <button key={o.id} role="tab" aria-selected={i === active} onClick={() => { setActive(i); setLoaded(false); }} className="h-10 border border-[#D1D5DB] px-4 text-sm aria-selected:border-[#2F447D] aria-selected:bg-[#2F447D] aria-selected:text-white">{o.name}</button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="relative aspect-[4/3] bg-[#EEF1F8] lg:col-span-8 lg:aspect-video" style={{ backgroundImage: "linear-gradient(#DDE3F1 1px, transparent 1px), linear-gradient(90deg, #DDE3F1 1px, transparent 1px)", backgroundSize: "32px 32px" }}>
          {loaded ? (
            <iframe title={`Map of ${office.name}`} src={embed} className="absolute inset-0 size-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <span className="grid size-14 place-items-center border-2 border-[#2F447D] text-[#843C40]"><MapPin aria-hidden className="size-7" /></span>
                <p className="max-w-[40ch] text-[#374151]">{office.lines.join(", ")}</p>
                <Button variant="outline" onClick={() => setLoaded(true)}>Load map</Button>
              </div>
            </div>
          )}
        </div>
        <address className="not-italic lg:col-span-4">
          <p className="font-display text-xl font-semibold">{office.name}</p>
          {office.lines.map((l) => <span key={l} className="block text-[#374151]">{l}</span>)}
          <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 font-medium text-[#0D5380] underline underline-offset-[3px]">Get directions<ArrowUpRight aria-hidden className="size-4" /></a>
        </address>
      </div>
    </div>
  );
}
