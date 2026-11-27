"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Navigation (plan 8.6). Read-only view of the header menu; the tree editor is not built yet (see README). */
export default function NavigationPage() {
  const q = useQuery({ queryKey: ["admin", "menus", "HEADER"], queryFn: () => adminApi.menus("HEADER") });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold leading-8">Navigation and footer</h1>
      <Card className="rounded-none shadow-none">
        <CardHeader><CardTitle className="text-base">Header menu</CardTitle></CardHeader>
        <CardContent>
          {q.isPending ? <p className="text-[#4B5563]">Loading...</p> : (
            <ol className="list-decimal space-y-1 ps-6">
              {q.data?.items.map((i) => <li key={i.id}>{i.label} <span className="text-[#6B7280]">{i.href}</span></li>)}
            </ol>
          )}
          <p className="mt-4 text-xs text-[#6B7280]">Reordering and editing menu items is not available in this build. Edit the menu through the API until the tree editor ships.</p>
        </CardContent>
      </Card>
    </div>
  );
}
