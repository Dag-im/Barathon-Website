"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";

const columns: ColumnDef[] = [
  { key: "title", label: "Title" },
  { key: "publishedAt", label: "Published", render: (r) => (r.publishedAt ? String(r.publishedAt).slice(0, 10) : "") },
];

const fields: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "slug", label: "Slug", type: "slug" },
  { key: "excerpt", label: "Excerpt", type: "textarea", required: true, rows: 2, help: "50 to 300 characters." },
  { key: "authorName", label: "Author", type: "text" },
  { key: "bodyHtml", label: "Body (HTML)", type: "html" },
];

export default function NewsPage() {
  return <ResourceScreen title="News" resource="posts" singular="post" columns={columns} fields={fields} emptyTitle="No news yet" />;
}
