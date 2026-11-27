"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";

const columns: ColumnDef[] = [
  { key: "title", label: "Title" },
  { key: "features", label: "Features", render: (r) => String((r.features as unknown[] | undefined)?.length ?? 0) },
];

const fields: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "slug", label: "Slug", type: "slug" },
  { key: "shortDescription", label: "Short description", type: "textarea", required: true, rows: 2 },
  { key: "featuresText", label: "Features (one per line, \"Title – description\")", type: "textarea", rows: 6 },
];

/** Services (plan 8.11). Features are edited one per line; the dash splits title and description. */
export default function ServicesPage() {
  return (
    <ResourceScreen
      title="Services" resource="services" singular="service" columns={columns} fields={fields} emptyTitle="No services found"
      toForm={(r) => ({
        ...r,
        featuresText: ((r.features as { title: string; description: string | null }[] | undefined) ?? [])
          .map((f) => (f.description ? `${f.title} – ${f.description}` : f.title)).join("\n"),
      })}
      fromForm={(v) => ({
        title: v.title, slug: v.slug, shortDescription: v.shortDescription,
        features: String(v.featuresText ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
          const m = l.match(/^(.*?)\s+[–-]\s+(.*)$/);
          return { title: m?.[1] ?? l, description: m?.[2] ?? null };
        }),
      })}
    />
  );
}
