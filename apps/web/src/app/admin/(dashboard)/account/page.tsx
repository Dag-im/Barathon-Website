"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Account (plan 8.16): password change and active sessions. Two-factor setup is out of scope (amendment A3). */
export default function AccountPage() {
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: ["admin", "sessions"], queryFn: () => adminApi.sessions() });
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.revokeSession(id),
    onSuccess: () => { toast.success("Session revoked"); qc.invalidateQueries({ queryKey: ["admin", "sessions"] }); },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold leading-8">Account</h1>
        <Card className="rounded-none shadow-none">
          <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
          <CardContent><ChangePasswordForm /></CardContent>
        </Card>
      </div>
      <Card className="rounded-none shadow-none">
        <CardHeader><CardTitle className="text-base">Active sessions</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-[#E5E7EB]">
            {(sessions.data?.data ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div><p className="font-medium">{s.deviceLabel ?? "Browser"} {s.current ? <span className="ms-2 bg-[#EEF1F8] px-2 py-0.5 text-xs text-[#25376A]">This session</span> : null}</p><p className="text-xs text-[#6B7280]">Last active {new Date(s.lastUsedAt).toLocaleString("en-GB", { timeZone: "UTC" })}</p></div>
                {s.current ? null : <Button variant="outline" size="sm" onClick={() => revoke.mutate(s.id)}>Revoke</Button>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
