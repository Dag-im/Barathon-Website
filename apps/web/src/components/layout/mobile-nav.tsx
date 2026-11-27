"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Phone, Mail, Search, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import type { MenuItemDto, SiteDto } from "@/lib/api/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** Mobile sheet navigation (design 6.7): accordion for items with children. */
export function MobileNav({ items, site, onSearch }: { items: MenuItemDto[]; site: SiteDto; onSearch: () => void }) {
  const [open, setOpen] = useState(false);
  const phones = site.channels.filter((c) => c.type === "PHONE");
  const email = site.channels.find((c) => c.type === "EMAIL");
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11" aria-label="Open menu">
          <Menu aria-hidden className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[min(92vw,400px)] flex-col gap-0 p-0">
        <SheetHeader className="flex-row items-center justify-between border-b border-[#E5E7EB] p-4">
          <SheetTitle className="sr-only">Site navigation</SheetTitle>
          <Logo variant="full" className="h-8" href={null} />
        </SheetHeader>
        <div className="p-4">
          <Button variant="outline" className="h-12 w-full justify-start gap-3" onClick={() => { setOpen(false); onSearch(); }}>
            <Search aria-hidden className="size-5" /> Search products, brands...
          </Button>
        </div>
        <nav aria-label="Mobile primary" className="flex-1 overflow-y-auto">
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b border-[#E5E7EB]">
                {item.children.length ? (
                  <Collapsible>
                    <CollapsibleTrigger className="flex h-14 w-full items-center justify-between px-4 font-display text-xl font-medium">
                      {item.label}
                      <ChevronDown aria-hidden className="size-5 text-[#2F447D]" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="pb-2">
                        {item.children.map((c) => (
                          <li key={c.id}>
                            <SheetClose asChild>
                              <Link href={c.href} className="flex h-12 items-center ps-8 pe-4 text-[17px] text-[#4B5563]">{c.label}</Link>
                            </SheetClose>
                          </li>
                        ))}
                        {item.viewAll ? (
                          <li>
                            <SheetClose asChild>
                              <Link href={item.viewAll.href} className="flex h-12 items-center ps-8 pe-4 text-[17px] font-medium text-[#0D5380]">{item.viewAll.label}</Link>
                            </SheetClose>
                          </li>
                        ) : null}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <SheetClose asChild>
                    <Link href={item.href} className="flex h-14 items-center px-4 font-display text-xl font-medium">{item.label}</Link>
                  </SheetClose>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="bg-[#111827] p-5 text-white">
          <Button asChild variant="primary" className="h-[52px] w-full bg-white text-[#111827] hover:bg-[#EEF1F8]">
            <Link href={site.headerCta.href} onClick={() => setOpen(false)}>{site.headerCta.label}</Link>
          </Button>
          <ul className="mt-4 space-y-1">
            {phones.map((p) => (
              <li key={p.id}><a href={p.href} className="flex h-11 items-center gap-3 text-white"><Phone aria-hidden className="size-5 text-[#60A5FA]" />{p.displayValue}</a></li>
            ))}
            {email ? <li><a href={email.href} className="flex h-11 items-center gap-3 text-white"><Mail aria-hidden className="size-5 text-[#60A5FA]" />{email.displayValue}</a></li> : null}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
