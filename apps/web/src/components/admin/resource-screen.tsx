"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminRow } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusEmpty } from "@/components/content/status-empty";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "url" | "number" | "slug" | "textarea" | "html" | "select" | "checkbox" | "list";
  required?: boolean;
  rows?: number;
  help?: string;
  options?: { value: string; label: string }[];
}

export interface ColumnDef { key: string; label: string; render?: (row: AdminRow) => React.ReactNode }

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "bg-[#DCFCE7] text-[#166534]", DRAFT: "bg-[#F1F3F5] text-[#374151]", ARCHIVED: "bg-[#FEF3C7] text-[#92400E]", NEW: "bg-[#F4DDDF] text-[#6D3034]", READ: "bg-[#F1F3F5] text-[#374151]",
};

/** Generic CRUD screen (plan 8.1 EntityListScreen + 8.5 EntityFormScreen, dialog form). */
export function ResourceScreen({
  title, resource, singular, columns, fields, emptyTitle, canPublish = true, canCreate = true, extraQuery, toForm, fromForm,
}: {
  title: string; resource: string; singular: string; columns: ColumnDef[]; fields: FieldDef[];
  emptyTitle: string; canPublish?: boolean; canCreate?: boolean; extraQuery?: Record<string, string>;
  toForm?: (row: AdminRow) => Record<string, unknown>; fromForm?: (values: Record<string, unknown>) => Record<string, unknown>;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<AdminRow | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminRow | null>(null);
  const key = ["admin", resource, q, status];
  const list = useQuery({ queryKey: key, queryFn: () => adminApi.list(resource, { q, status, ...extraQuery }) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", resource] });
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "unpublish" }) => adminApi.transition(resource, id, action),
    onSuccess: (_d, v) => { toast.success(v.action === "publish" ? "Published" : "Unpublished"); invalidate(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not change status"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.remove(resource, id),
    onSuccess: () => { toast.success("Deleted"); setConfirmDelete(null); invalidate(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Delete failed"),
  });

  const rows = list.data?.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-8">{title}</h1>
          <p className="text-[13px] text-[#4B5563]">{list.data ? `${list.data.meta.total} records` : " "}</p>
        </div>
        {canCreate ? <Button onClick={() => setEditing("new")}><Plus aria-hidden className="size-4" />New {singular}</Button> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] pb-3">
        <Input placeholder={`Search ${title.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-72" aria-label="Search" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 border border-[#878F9D] bg-white px-2" aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      {list.isError ? (
        <div role="alert" className="border border-[#FCA5A5] bg-[#FEE2E2] p-4 text-[#991B1B]">Could not load {title.toLowerCase()}. <Button variant="link" className="text-[#991B1B]" onClick={() => list.refetch()}>Try again</Button></div>
      ) : list.isPending ? (
        <div className="space-y-2" aria-busy="true">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse bg-[#E5E7EB]" />)}</div>
      ) : rows.length === 0 ? (
        <StatusEmpty title={`No ${title.toLowerCase()} found`} action={canCreate ? <Button size="sm" onClick={() => setEditing("new")}>Add your first {singular}</Button> : null} />
      ) : (
        <div className="overflow-x-auto border border-[#E5E7EB] bg-white">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-[#F1F3F5] text-[12px] uppercase tracking-[0.06em] text-[#4B5563]">
              <tr>{columns.map((c) => <th key={c.key} scope="col" className="h-10 px-3 font-medium">{c.label}</th>)}<th scope="col" className="px-3 text-right font-medium">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#E5E7EB] hover:bg-[#F8F9FA]">
                  {columns.map((c) => <td key={c.key} className="px-3 py-2.5 align-top">{c.render ? c.render(r) : String(r[c.key] ?? "")}</td>)}
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {r.status ? <span className={cn("me-2 inline-flex h-6 items-center px-2 text-xs font-medium", STATUS_TONE[String(r.status)] ?? "bg-[#F1F3F5]")}>{String(r.status).toLowerCase()}</span> : null}
                      {canPublish && r.status ? (
                        <Button variant="ghost" size="icon-sm" aria-label={r.status === "PUBLISHED" ? `Unpublish ${String(r.title ?? r.name ?? singular)}` : `Publish ${String(r.title ?? r.name ?? singular)}`} onClick={() => transition.mutate({ id: r.id, action: r.status === "PUBLISHED" ? "unpublish" : "publish" })}>
                          {r.status === "PUBLISHED" ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${String(r.title ?? r.name ?? r.source ?? singular)}`} onClick={() => setEditing(r)}><Pencil aria-hidden className="size-4" /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${String(r.title ?? r.name ?? r.source ?? singular)}`} onClick={() => setConfirmDelete(r)}><Trash2 aria-hidden className="size-4 text-[#B91C1C]" /></Button>
                    </div>
                    {r.warnings?.length ? <Badge variant="outline" className="mt-1 border-[#FCD34D] text-[#92400E]">{r.warnings.length} warning{r.warnings.length > 1 ? "s" : ""}</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? (
        <ResourceForm
          key={editing === "new" ? "new" : editing.id}
          resource={resource}
          singular={singular}
          fields={fields}
          row={editing === "new" ? null : editing}
          toForm={toForm}
          fromForm={fromForm}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      ) : null}
      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {singular}?</AlertDialogTitle>
            <AlertDialogDescription>It moves to the trash and disappears from the public site after the cache refreshes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#B91C1C] text-white hover:bg-[#991B1B]" onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResourceForm({ resource, singular, fields, row, toForm, fromForm, onClose, onSaved }: {
  resource: string; singular: string; fields: FieldDef[]; row: AdminRow | null; toForm?: (r: AdminRow) => Record<string, unknown>; fromForm?: (v: Record<string, unknown>) => Record<string, unknown>; onClose: () => void; onSaved: () => void;
}) {
  const initial = row ? (toForm ? toForm(row) : Object.fromEntries(fields.map((f) => [f.key, f.type === "list" ? ((row[f.key] as string[] | undefined) ?? []).join("\n") : row[f.key] ?? (f.type === "checkbox" ? false : "")]))) : Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : ""]));
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Record<string, unknown>>({ defaultValues: initial });
  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      const body = fromForm ? fromForm(values) : Object.fromEntries(fields.map((f) => {
        const v = values[f.key];
        if (f.type === "list") return [f.key, String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean)];
        if (f.type === "number") return [f.key, Number(v) || 0];
        return [f.key, v];
      }));
      return row ? adminApi.update(resource, row.id, { ...body, expectedVersion: row.version }) : adminApi.create(resource, body);
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        for (const [k, v] of Object.entries(e.fieldErrors())) setError(k, { message: v });
        toast.error("Please correct the highlighted fields");
      } else toast.error(e instanceof ApiError && e.status === 409 ? "This item was changed elsewhere. Reload and try again." : "Could not save");
    },
  });
  const requiredErr = (f: FieldDef) => (errors[f.key] as { message?: string } | undefined)?.message;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${singular}` : `New ${singular}`}</DialogTitle>
          <DialogDescription>Changes are saved as a draft until you publish.</DialogDescription>
        </DialogHeader>
        <form id="resource-form" noValidate onSubmit={handleSubmit((v) => {
          for (const f of fields) if (f.required && f.type !== "checkbox" && !String(v[f.key] ?? "").trim()) { setError(f.key, { message: `${f.label} is required` }); return; }
          save.mutate(v);
        })} className="grid gap-4">
          {fields.map((f) => {
            const id = `f-${f.key}`;
            const err = requiredErr(f);
            const common = { "aria-invalid": Boolean(err) || undefined, "aria-describedby": err ? `${id}-err` : undefined };
            return (
              <div key={f.key} className={cn(f.type === "checkbox" ? "flex items-center gap-2" : "grid gap-1.5")}>
                {f.type === "checkbox" ? (
                  <>
                    <input id={id} type="checkbox" className="size-4 accent-[#2F447D]" {...register(f.key)} />
                    <Label htmlFor={id}>{f.label}</Label>
                  </>
                ) : (
                  <Label htmlFor={id}>{f.label}{f.required ? <span className="text-[#B91C1C]" aria-hidden> *</span> : null}</Label>
                )}
                {f.type === "textarea" || f.type === "html" || f.type === "list" ? (
                  <Textarea id={id} rows={f.type === "textarea" ? (f.rows ?? 3) : f.type === "list" ? 4 : 10} className={cn(f.type === "html" && "font-mono text-[13px]")} {...register(f.key)} {...common} />
                ) : f.type === "select" ? (
                  <select id={id} className="h-9 border border-[#878F9D] bg-white px-2" {...register(f.key)} {...common}>
                    <option value="">Choose...</option>
                    {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === "checkbox" ? null : (
                  <Input id={id} type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} className="h-9" {...register(f.key)} {...common} />
                )}
                {f.help ? <p className="text-xs text-[#6B7280]">{f.help}</p> : null}
                {err ? <p id={`${id}-err`} className="text-xs text-[#B91C1C]" role="alert">{err}</p> : null}
              </div>
            );
          })}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="resource-form" loading={save.isPending} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
