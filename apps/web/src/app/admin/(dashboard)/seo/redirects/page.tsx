"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";

const columns: ColumnDef[] = [
  { key: "source", label: "From" },
  { key: "target", label: "To" },
  { key: "type", label: "Type" },
];

const fields: FieldDef[] = [
  { key: "source", label: "From (path starting with /)", type: "text", required: true },
  { key: "target", label: "To (path or https URL)", type: "text", required: true },
  { key: "type", label: "Type", type: "select", options: [
    { value: "MOVED_301", label: "301 permanent" }, { value: "FOUND_302", label: "302 temporary" }, { value: "TEMP_307", label: "307" }, { value: "PERM_308", label: "308 permanent" },
  ] },
];

/** Redirects are resolved at request time, so changes apply without a deploy. Loops are rejected by the API. */
export default function RedirectsPage() {
  return <ResourceScreen title="Redirects" resource="redirects" singular="redirect" columns={columns} fields={fields} emptyTitle="No redirects" canPublish={false} />;
}
