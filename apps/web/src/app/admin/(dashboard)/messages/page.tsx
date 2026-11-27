"use client";

import { ResourceScreen, type ColumnDef, type FieldDef } from "@/components/admin/resource-screen";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "excerpt", label: "Message", render: (r) => String(r.excerpt ?? r.message ?? "").slice(0, 90) },
  { key: "productTitle", label: "Product" },
  { key: "status", label: "Status", render: (r) => (r.status === "NEW" ? <Badge className="bg-[#F4DDDF] text-[#6D3034]">New</Badge> : String(r.status ?? "").toLowerCase()) },
];

const fields: FieldDef[] = [
  { key: "status", label: "Status", type: "select", options: [
    { value: "NEW", label: "New" }, { value: "READ", label: "Read" }, { value: "REPLIED", label: "Replied" }, { value: "ARCHIVED", label: "Archived" }, { value: "SPAM", label: "Spam" },
  ] },
];

/** Inbox (plan 8.13). Messages are stored only; no notification email (amendment A1). */
export default function MessagesPage() {
  return (
    <ResourceScreen
      title="Messages" resource="messages" singular="message" columns={columns} fields={fields} emptyTitle="No messages found"
      canCreate={false} canPublish={false}
      toForm={(r) => ({ status: r.status })}
      fromForm={(v) => ({ status: v.status })}
    />
  );
}
