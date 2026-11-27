"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Settings = { siteName: string; legalName: string; tagline: string; seoDefaults: { titleTemplate: string; defaultTitle: string; defaultDescription: string }; footer: { copyright: string } };

/** Site settings (plan 8.5): identity, footer text and SEO defaults. The developer credit is fixed and not editable (amendment A4). */
export default function SettingsPage() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminApi.settings() as unknown as Promise<Settings> });
  if (q.isPending) return <div className="h-40 animate-pulse bg-[#E5E7EB]" aria-busy="true" />;
  if (!q.data) return null;
  return <SettingsForm initial={q.data} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const { register, handleSubmit } = useForm<{ siteName: string; legalName: string; tagline: string; titleTemplate: string; defaultTitle: string; defaultDescription: string; copyright: string }>({
    defaultValues: {
      siteName: initial.siteName, legalName: initial.legalName, tagline: initial.tagline,
      titleTemplate: initial.seoDefaults.titleTemplate, defaultTitle: initial.seoDefaults.defaultTitle, defaultDescription: initial.seoDefaults.defaultDescription,
      copyright: initial.footer.copyright,
    },
  });
  const save = useMutation({
    mutationFn: (v: Record<string, string>) => apiPut(v),
    onSuccess: () => toast.success("Settings saved"),
    onError: () => toast.error("Could not save settings"),
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold leading-8">Site settings</h1>
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-none shadow-none">
          <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="siteName">Site name</Label><Input id="siteName" className="h-9" {...register("siteName")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="legalName">Legal name</Label><Input id="legalName" className="h-9" {...register("legalName")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="tagline">Tagline</Label><Input id="tagline" className="h-9" {...register("tagline")} /></div>
          </CardContent>
        </Card>
        <Card className="rounded-none shadow-none">
          <CardHeader><CardTitle className="text-base">Default SEO</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="titleTemplate">Title template (must contain %s)</Label><Input id="titleTemplate" className="h-9" {...register("titleTemplate")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="defaultTitle">Home title</Label><Input id="defaultTitle" className="h-9" {...register("defaultTitle")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="defaultDescription">Default description (120 to 160 characters)</Label><Input id="defaultDescription" className="h-9" {...register("defaultDescription")} /></div>
          </CardContent>
        </Card>
        <Card className="rounded-none shadow-none lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Footer</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="copyright">Copyright text ({"{year}"} is replaced)</Label><Input id="copyright" className="h-9" {...register("copyright")} /></div>
            <div className="grid gap-1.5"><Label>Developer credit</Label><p className="flex h-9 items-center text-[#374151]">Developed by Dagim Meseret (fixed)</p></div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2"><Button type="submit" loading={save.isPending} disabled={save.isPending}>Save settings</Button></div>
      </form>
    </div>
  );
}

async function apiPut(v: Record<string, string>) {
  const { apiRequest } = await import("@/lib/api/client");
  return apiRequest("/admin/settings", {
    method: "PUT",
    body: {
      siteName: v.siteName, legalName: v.legalName, tagline: v.tagline,
      seoDefaults: { titleTemplate: v.titleTemplate, defaultTitle: v.defaultTitle, defaultDescription: v.defaultDescription },
      footer: { copyright: v.copyright },
    },
  });
}
