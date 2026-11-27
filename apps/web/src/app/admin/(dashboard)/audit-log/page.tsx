"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { StatusEmpty } from "@/components/content/status-empty";

/** Audit log (plan 8.17): read-only table of admin actions. */
export default function AuditPage() {
  const q = useQuery({ queryKey: ["admin", "audit"], queryFn: () => adminApi.audit({ pageSize: 50 }) });
  const rows = q.data?.data ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold leading-8">Audit log</h1>
      {rows.length === 0 && !q.isPending ? <StatusEmpty title="No activity recorded" /> : (
        <div className="overflow-x-auto border border-[#E5E7EB] bg-white">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">Audit log entries</caption>
            <thead className="bg-[#F1F3F5] text-[12px] uppercase tracking-[0.06em] text-[#4B5563]"><tr><th scope="col" className="h-10 px-3">Time</th><th scope="col" className="px-3">Actor</th><th scope="col" className="px-3">Action</th><th scope="col" className="px-3">Entity</th><th scope="col" className="px-3">Summary</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#E5E7EB]">
                  <td className="px-3 py-2 tabular-nums">{new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2">{r.actorEmail ?? "system"}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">{r.entityType ?? ""}</td>
                  <td className="px-3 py-2">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
