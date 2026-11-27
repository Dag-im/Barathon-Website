"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api/admin";

/** Identifier-only reset (amendment A2). The response never reveals whether the account exists. */
export function ForgotForm() {
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setBusy(true);
    try {
      const res = await adminApi.forgotPassword(identifier.trim());
      setDone(res.message);
    } catch {
      setDone("If the account exists, its password was reset to the default password. Sign in and you will be asked to choose a new one.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5">
      <h1 className="font-display text-[28px] leading-8 font-bold text-center">Forgot Password</h1>
      {done ? (
        <div role="status" className="border border-[#BCC8E2] bg-[#EEF1F8] p-4 text-[#25376A]">{done}</div>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="identifier">Enter your email or username</Label>
            <Input id="identifier" autoComplete="username" className="h-11" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={busy}>Reset password</Button>
        </form>
      )}
      <Link href="/admin/login" className="text-center text-[#0D5380] underline underline-offset-[3px]">Back to sign in</Link>
    </div>
  );
}
