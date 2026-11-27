"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Home as HomeIcon, Info, Package, Factory, Wrench, Video, Quote, HelpCircle, Newspaper, Image as ImageIcon, Mail, Settings, Menu as MenuIcon, Search, Link2, ScrollText, UserCog, LogOut, Sun, Moon, ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { adminApi } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Content", items: [
    { href: "/admin/homepage", label: "Homepage", icon: HomeIcon },
    { href: "/admin/about", label: "About", icon: Info },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/brands", label: "Brands", icon: Factory },
    { href: "/admin/services", label: "Services", icon: Wrench },
    { href: "/admin/videos", label: "Videos", icon: Video },
    { href: "/admin/testimonials", label: "Testimonials", icon: Quote },
    { href: "/admin/faq", label: "FAQ", icon: HelpCircle },
    { href: "/admin/news", label: "News", icon: Newspaper },
  ] },
  { label: "Media", items: [{ href: "/admin/media", label: "Media library", icon: ImageIcon }] },
  { label: "Inbox", items: [{ href: "/admin/messages", label: "Messages", icon: Mail }] },
  { label: "Site", items: [
    { href: "/admin/settings", label: "Site settings", icon: Settings },
    { href: "/admin/navigation", label: "Navigation & footer", icon: MenuIcon },
    { href: "/admin/seo/redirects", label: "Redirects", icon: Link2 },
  ] },
  { label: "System", items: [
    { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
    { href: "/admin/account", label: "Account", icon: UserCog },
  ] },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn("relative flex h-9 items-center gap-3 px-3 text-sm text-[#D1D5DB] hover:bg-[#1F2937] hover:text-white", active && "bg-[#1F2937] text-white before:absolute before:start-0 before:top-0 before:h-full before:w-[3px] before:bg-[#60A5FA]")}
                  >
                    <Icon aria-hidden className={cn("size-[18px] stroke-[1.5]", active ? "text-[#60A5FA]" : "text-[#9CA3AF]")} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Admin chrome: navy sidebar (both themes), top bar, sheet on small screens (design 8.2). */
export function AdminShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {
      /* session may already be gone */
    }
    router.push("/admin/login");
    router.refresh();
  };
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };
  return (
    <div data-admin className="min-h-dvh bg-[#F8F9FA] text-[14px] text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-[#111827] p-4 text-[#D1D5DB] lg:flex">
        <div className="flex h-12 items-center gap-3 px-2"><Logo variant="mark" tone="white" href="/admin" className="h-7" /><span className="text-sm text-[#9CA3AF]">Admin</span></div>
        <div className="mt-6 flex-1"><Nav /></div>
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 px-2">
          <div className="min-w-0"><p className="truncate font-medium text-white">{userName}</p></div>
          <Button variant="ghost" size="icon-sm" onClick={logout} className="text-[#D1D5DB] hover:bg-[#1F2937] hover:text-white" aria-label="Sign out"><LogOut aria-hidden className="size-4" /></Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-[#E5E7EB] bg-white px-4">
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation"><MenuIcon aria-hidden className="size-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="w-[280px] bg-[#111827] p-4 text-[#D1D5DB]">
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <Nav />
            </SheetContent>
          </Sheet>
          <div className="hidden h-8 w-80 items-center gap-2 border border-[#D1D5DB] px-3 text-[#6B7280] md:flex" aria-hidden="true">
            <Search aria-hidden className="size-4" /> Go to... <span className="ms-auto rounded-sm border px-1 text-xs">Ctrl K</span>
          </div>
          <div className="ms-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm"><a href="/" target="_blank" rel="noopener noreferrer">View site<ArrowUpRight aria-hidden className="size-4" /></a></Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label={dark ? "Light theme" : "Dark theme"}>{dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}</Button>
          </div>
        </header>
        <main id="admin-main" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6">{children}</main>
      </div>
    </div>
  );
}
