"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";

const columns: ColumnDef[] = [
  { key: "personName", label: "Name" },
  { key: "companyName", label: "Company" },
  { key: "quote", label: "Quote", render: (r) => String(r.quote ?? "").slice(0, 80) },
];

const fields: FieldDef[] = [
  { key: "quote", label: "Quote", type: "textarea", required: true, rows: 3 },
  { key: "personName", label: "Name", type: "text", required: true },
  { key: "personRole", label: "Role", type: "text" },
  { key: "companyName", label: "Company", type: "text" },
  { key: "rating", label: "Rating (1-5)", type: "number" },
];

export default function TestimonialsPage() {
  return <ResourceScreen title="Testimonials" resource="testimonials" singular="testimonial" columns={columns} fields={fields} emptyTitle="No testimonials found" />;
}
