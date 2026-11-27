"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Phone, Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { MegaMenu } from "./mega-menu";
import { MobileNav } from "./mobile-nav";
import { SearchCommand } from "./search-command";
import { Kbd } from "@/components/content/kbd";
import type { SiteDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Site header (design 6.6 / 5.3). Utility bar on desktop, one main bar, a
 * condensed state after 24px of scroll, search palette and mobile sheet.
 */
export function SiteHeader({ site }: { site: SiteDto }) {
  const pathname = usePathname();
  const [condensed, setCondensed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const header = site.menus.HEADER;
  const phones = site.channels.filter((c) => c.showInHeader && c.type === "PHONE");

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className={cn("sticky top-0 z-40 bg-white transition-shadow", condensed && "header-solid")}>
      <div className={cn("hidden overflow-hidden bg-[#111827] text-[13px] text-[#D1D5DB] transition-[height] duration-250 lg:block", condensed ? "h-0" : "h-10")} aria-hidden={condensed || undefined}>
        <div className="container-site flex h-10 items-center justify-between">
          <div className="flex items-center gap-4">
            <Phone aria-hidden className="size-3.5" />
            {phones.map((p, i) => (
              <span key={p.id} className="flex items-center gap-4">
                {i > 0 ? <span className="h-3 w-px bg-white/20" /> : null}
                <a href={p.href} className="whitespace-nowrap hover:text-white" tabIndex={condensed ? -1 : undefined}>{p.displayValue}</a>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><MapPin aria-hidden className="size-3.5" />Addis Ababa, Ethiopia</span>
          </div>
        </div>
      </div>
      <div className={cn("border-b border-[#E5E7EB] transition-[height] duration-250", condensed ? "h-16" : "h-16 lg:h-20")}>
        <div className="container-site flex h-full items-center gap-6">
          <Logo variant="full" className={cn("transition-[height] duration-250", condensed ? "h-9" : "h-9 lg:h-11")} />
          <nav aria-label="Primary" className="hidden flex-1 items-center gap-8 lg:flex">
            {header.map((item) =>
              item.children.length ? (
                <MegaMenu key={item.id} item={item} active={isActive(item.href)} />
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center font-display text-[16px] font-medium text-foreground hover:text-[#2F447D] hover:underline hover:decoration-2 hover:underline-offset-[6px]",
                    isActive(item.href) && "font-semibold underline decoration-[#843C40] decoration-2 underline-offset-[6px]",
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-11 w-60 items-center gap-2 border border-[#878F9D] bg-white px-3.5 text-start text-[#6B7280] hover:border-[#4B5563] xl:flex"
              aria-label="Search the site (press slash)"
            >
              <Search aria-hidden className="size-5" />
              <span className="flex-1 text-[15px]">Search products...</span>
              <Kbd>/</Kbd>
            </button>
            <Button variant="ghost" size="icon" className="size-11 xl:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search aria-hidden className="size-5" />
            </Button>
            {site.headerCta.enabled ? (
              <Button asChild variant="dark" size="md" className="hidden lg:inline-flex">
                <Link href={site.headerCta.href}>{site.headerCta.label}<Phone aria-hidden className="size-4" /></Link>
              </Button>
            ) : null}
            <div className="lg:hidden">
              <MobileNav items={header} site={site} onSearch={() => setSearchOpen(true)} />
            </div>
          </div>
        </div>
      </div>
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
