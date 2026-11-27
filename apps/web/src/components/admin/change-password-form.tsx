"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/errors";

type Values = { currentPassword: string; newPassword: string; confirm: string };

/** Forced change (amendment A2): only the new password. Normal change also asks for the current one. */
export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>();
  const onSubmit = async (v: Values) => {
    if (v.newPassword.length < 12) return setError("newPassword", { message: "Use at least 12 characters." });
    if (v.newPassword !== v.confirm) return setError("confirm", { message: "The passwords do not match." });
    setBusy(true);
    try {
      await adminApi.changePassword({ newPassword: v.newPassword, currentPassword: forced ? undefined : v.currentPassword });
      toast.success("Password changed");
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 422) setError("newPassword", { message: e.message });
      else if (e instanceof ApiError && e.status === 401) setError("currentPassword", { message: "The current password is incorrect." });
      else toast.error("Could not change the password");
    }
  };
  return (
    <div className="grid gap-5">
      <h1 className="font-display text-[28px] leading-8 font-bold text-center">{forced ? "Choose a new password" : "Change password"}</h1>
      {forced ? <p className="text-[#4B5563]">Your password was reset to the default. Choose a new password to continue.</p> : null}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        {forced ? null : (
          <div className="grid gap-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" type="password" autoComplete="current-password" className="h-11" {...register("currentPassword", { required: true })} />
            {errors.currentPassword ? <p className="text-xs text-[#B91C1C]">{errors.currentPassword.message}</p> : null}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input id="newPassword" type="password" autoComplete="new-password" className="h-11" aria-describedby="pw-help" {...register("newPassword", { required: true })} />
          <p id="pw-help" className="text-xs text-[#6B7280]">At least 12 characters. It must differ from the default password.</p>
          {errors.newPassword ? <p className="text-xs text-[#B91C1C]">{errors.newPassword.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" className="h-11" {...register("confirm", { required: true })} />
          {errors.confirm ? <p className="text-xs text-[#B91C1C]">{errors.confirm.message}</p> : null}
        </div>
        <Button type="submit" size="lg" loading={busy} disabled={busy}>Save password</Button>
      </form>
    </div>
  );
}
