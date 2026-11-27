import { cookies } from "next/headers";
import Link from "next/link";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

/** Dashboard (design 8.3): stat cards, inbox count, needs-attention list and quick actions. */
export default async function DashboardPage() {
  const jar = await cookies();
  const cookie = jar.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const d = await adminApi.dashboard(cookie);
  const stat = (label: string, key: string) => {
    const c = d.counts[key];
    return (
      <Card key={key} className="rounded-none p-4 shadow-none">
        <p className="text-[13px] text-[#4B5563]">{label}</p>
        <p className="mt-1 font-display text-[32px] leading-9 font-bold tabular-nums">{c?.published ?? 0}</p>
        <p className="text-xs text-[#6B7280]">{c?.total ?? 0} total · {c?.draft ?? 0} draft</p>
      </Card>
    );
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-8">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link href="/admin/products">New product</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/admin/news">New post</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/admin/media">Media</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/admin/homepage">Edit homepage</Link></Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stat("Published products", "products")}
        {stat("Published brands", "brands")}
        {stat("Published services", "services")}
        {stat("Published videos", "videos")}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="rounded-none shadow-none lg:col-span-4">
          <CardHeader><CardTitle className="text-base">Inbox</CardTitle></CardHeader>
          <CardContent>
            <p className="font-display text-[40px] leading-10 font-bold text-[#843C40]">{d.messages.new}</p>
            <p className="text-[#4B5563]">new messages · {d.messages.total} total</p>
            <Link href="/admin/messages" className="mt-3 inline-block text-[#0D5380] underline underline-offset-[3px]">Open inbox</Link>
          </CardContent>
        </Card>
        <Card className="rounded-none shadow-none lg:col-span-8">
          <CardHeader><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {d.warnings.missingImages.length ? <li className="flex items-center gap-2 text-[#92400E]"><AlertTriangle aria-hidden className="size-4" />{d.warnings.missingImages.length} products without an image</li> : null}
              {d.warnings.socialLinksMissing ? <li className="flex items-center gap-2 text-[#92400E]"><AlertTriangle aria-hidden className="size-4" />No social links configured</li> : null}
              {!d.warnings.missingImages.length && !d.warnings.socialLinksMissing ? <li className="text-[#4B5563]">Nothing needs attention.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-none shadow-none">
        <CardHeader><CardTitle className="text-base">Recent messages</CardTitle></CardHeader>
        <CardContent>
          {d.recentMessages.length ? (
            <ul className="divide-y divide-[#E5E7EB]">
              {d.recentMessages.map((m) => <li key={m.id} className="flex justify-between py-2"><span className={m.status === "NEW" ? "font-semibold" : ""}>{m.name}</span><span className="text-[#4B5563]">{m.excerpt}</span></li>)}
            </ul>
          ) : <p className="text-[#4B5563]">No messages yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
