"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/errors";

/** Only in-app admin paths are accepted after login (open-redirect safe, plan 9.4). */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/admin(\/|$)/.test(next) && !next.startsWith("//") ? next : "/admin";
}

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; password: string }>();

  const onSubmit = async (v: { email: string; password: string }) => {
    setError(null);
    setBusy(true);
    try {
      const res = await adminApi.login(v);
      router.replace(res.mustChangePassword ? "/admin/change-password-required" : safeNext(next));
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 423) setError("Too many attempts. Try again later.");
      else if (e instanceof ApiError && e.status === 429) setError("Too many attempts. Try again in a few minutes.");
      else setError("Invalid email or password.");
    }
  };

  return (
    <div>
      <h1 className="font-display text-[28px] leading-8 font-bold text-center">Baraton Login</h1>
      {error ? <div role="alert" className="mt-4 flex items-start gap-2 border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-[#991B1B]"><AlertCircle aria-hidden className="mt-0.5 size-4" />{error}</div> : null}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4" aria-busy={busy || undefined}>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" className="h-11" aria-invalid={Boolean(errors.email) || undefined} {...register("email", { required: "Enter your email" })} />
          {errors.email ? <p className="text-xs text-[#B91C1C]">{errors.email.message}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" className="h-11 pe-11" aria-invalid={Boolean(errors.password) || undefined} {...register("password", { required: "Enter your password" })} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-1 top-1 grid size-9 place-items-center text-[#4B5563]" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-xs text-[#B91C1C]">{errors.password.message}</p> : null}
        </div>
        <Link href="/admin/forgot-password" className="justify-self-end text-[#0D5380] underline underline-offset-[3px]">Forgot Password?</Link>
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={busy}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-xs text-[#6B7280]">Baraton Group Co. administration</p>
    </div>
  );
}
