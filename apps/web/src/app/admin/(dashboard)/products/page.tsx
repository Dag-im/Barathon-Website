"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";

const CATEGORIES = [
  { value: "rock-drilling", label: "Rock drilling" },
  { value: "compressed-air", label: "Compressed air" },
  { value: "crushing", label: "Crushing" },
  { value: "concrete-mixing", label: "Concrete mixing" },
];

const columns: ColumnDef[] = [
  { key: "title", label: "Title" },
  { key: "brandSlug", label: "Brand" },
  { key: "categorySlug", label: "Category" },
  { key: "country", label: "Country", render: (r) => String((r.country as { name?: string } | undefined)?.name ?? "") },
  { key: "isFeatured", label: "Featured", render: (r) => (r.isFeatured ? "Yes" : "No") },
];

const fields: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "slug", label: "Slug", type: "slug", help: "Lowercase letters, numbers and hyphens. Changing it creates a redirect." },
  { key: "shortDescription", label: "Short description", type: "textarea", required: true, rows: 2 },
  { key: "countryName", label: "Country of origin", type: "text" },
  { key: "categorySlug", label: "Category", type: "select", options: CATEGORIES },
  { key: "brandSlug", label: "Brand slug", type: "text", help: "Must match a brand slug." },
  { key: "contentHtml", label: "Overview (HTML)", type: "html", help: "Sanitised by the API. Use <p>[video:ID]</p> to embed a YouTube video, or <p>[upload:/path.mp4]</p> for an uploaded file." },
  { key: "isFeatured", label: "Featured on the home page", type: "checkbox" },
];

/** Products (plan 8.10). Videos are linked from the Videos module. */
export default function ProductsPage() {
  return (
    <ResourceScreen
      title="Products" resource="products" singular="product" columns={columns} fields={fields} emptyTitle="No products found"
      toForm={(r) => ({ ...r, countryName: (r.country as { name?: string } | undefined)?.name ?? "" })}
      fromForm={(v) => ({
        title: v.title, slug: v.slug, shortDescription: v.shortDescription, contentHtml: v.contentHtml,
        categorySlug: v.categorySlug, brandSlug: v.brandSlug, isFeatured: Boolean(v.isFeatured),
        country: { name: String(v.countryName ?? "") || null, code: null, city: null },
      })}
    />
  );
}
