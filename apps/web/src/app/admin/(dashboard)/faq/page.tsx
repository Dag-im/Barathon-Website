"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";

const columns: ColumnDef[] = [{ key: "title", label: "Group" }, { key: "slug", label: "Slug" }];
const fields: FieldDef[] = [
  { key: "title", label: "Group title", type: "text", required: true },
  { key: "slug", label: "Slug", type: "slug" },
];

/** FAQ groups. Questions and answers are added per group once the group exists. */
export default function FaqPage() {
  return <ResourceScreen title="FAQ groups" resource="faq-groups" singular="FAQ group" columns={columns} fields={fields} emptyTitle="No FAQ groups found" />;
}
