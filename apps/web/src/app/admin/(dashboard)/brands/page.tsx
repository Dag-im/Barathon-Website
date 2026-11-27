"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";

const columns: ColumnDef[] = [
  { key: "name", label: "Name" },
  { key: "country", label: "Country", render: (r) => String((r.country as { name?: string } | undefined)?.name ?? "") },
  { key: "isExclusiveAgent", label: "Official agent", render: (r) => (r.isExclusiveAgent ? "Yes" : "No") },
];

const fields: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "slug" },
  { key: "shortDescription", label: "Short description", type: "textarea", required: true, rows: 2 },
  { key: "countryName", label: "Country", type: "text" },
  { key: "websiteUrl", label: "Website", type: "url" },
  { key: "descriptionHtml", label: "Description (HTML)", type: "html" },
  { key: "isExclusiveAgent", label: "Official agent in Ethiopia", type: "checkbox" },
];

/** Brands. Brand videos are managed in the Videos module (amendment A6). */
export default function BrandsPage() {
  return (
    <ResourceScreen
      title="Brands" resource="brands" singular="brand" columns={columns} fields={fields} emptyTitle="No companies found"
      toForm={(r) => ({ ...r, countryName: (r.country as { name?: string } | undefined)?.name ?? "" })}
      fromForm={(v) => ({
        name: v.name, slug: v.slug, shortDescription: v.shortDescription, descriptionHtml: v.descriptionHtml,
        websiteUrl: v.websiteUrl || null, isExclusiveAgent: Boolean(v.isExclusiveAgent),
        country: { name: String(v.countryName ?? "") || null, code: null, city: null },
      })}
    />
  );
}
