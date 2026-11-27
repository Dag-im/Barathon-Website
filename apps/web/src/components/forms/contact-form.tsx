"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, AlertCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { contactSchema, SUBJECTS, type ContactInput } from "@/lib/forms/contact";
import { submitContactAction } from "@/app/actions/contact";
import { cn } from "@/lib/utils";

type Prefill = { subject: string; productSlug: string; serviceSlug: string; brandSlug: string };

/** Contact form (plan 6.8, design 6.3). Honeypot and time trap; API errors map to fields. */
export function ContactForm({ prefill }: { prefill: Prefill }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{ reference: string | null; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const startedAt = useRef<number>(0);
  const [product, setProduct] = useState(prefill.productSlug);

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: {
      name: "", email: "", phone: "", company: "",
      subject: prefill.subject || "General enquiry",
      productSlug: prefill.productSlug, message: "", consent: false, website: "", formStartedAt: 0,
    },
  });
  const { register, handleSubmit, formState, setError, reset } = form;
  const errors = formState.errors;

  useEffect(() => {
    startedAt.current = Date.now();
    form.setValue("formStartedAt", startedAt.current);
  }, [form]);

  const onSubmit = (values: ContactInput) => {
    setFormError(null);
    startTransition(async () => {
      const res = await submitContactAction({ ...values, productSlug: product, formStartedAt: startedAt.current });
      if (res.ok) {
        setDone({ reference: res.reference, message: res.message });
        reset();
        toast.success("Message sent", { description: res.reference ? `Reference ${res.reference}` : undefined });
        // eslint-disable-next-line no-console
        if (typeof window !== "undefined" && (window as unknown as { dataLayer?: unknown[] }).dataLayer) (window as unknown as { dataLayer: unknown[] }).dataLayer.push({ event: "generate_lead" });
        return;
      }
      setFormError(res.message);
      toast.error(res.message);
      if (res.fieldErrors) {
        for (const [k, v] of Object.entries(res.fieldErrors)) setError(k as keyof ContactInput, { message: v });
      }
    });
  };

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4 border border-[#86EFAC] bg-[#F0FDF4] p-8">
        <CheckCircle2 aria-hidden className="size-8 text-[#15803D]" />
        <h3 className="t-h3 text-foreground">Message sent</h3>
        <p className="text-[#374151]">{done.message}{done.reference ? ` Your reference is ${done.reference}.` : ""}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link href="/products">Browse products</Link></Button>
          <Button variant="ghost" onClick={() => setDone(null)}>Send another message</Button>
        </div>
      </div>
    );
  }

  const field = (name: keyof ContactInput) => ({
    "aria-invalid": Boolean(errors[name]) || undefined,
    "aria-describedby": errors[name] ? `${String(name)}-error` : undefined,
  });
  const err = (name: keyof ContactInput) =>
    errors[name] ? (
      <p id={`${String(name)}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm text-[#B91C1C]"><AlertCircle aria-hidden className="size-4" />{errors[name]?.message}</p>
    ) : null;

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5" aria-busy={pending || undefined}>
      {formError ? (
        <div role="alert" className="flex items-start gap-2 border border-[#FCA5A5] bg-[#FEE2E2] p-4 text-[#991B1B]"><AlertCircle aria-hidden className="mt-0.5 size-5" />{formError}</div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Full name <span className="text-[#B91C1C]" aria-hidden>*</span></Label>
          <Input id="name" autoComplete="name" placeholder="Full name" className="mt-1.5 h-11" required {...register("name")} {...field("name")} />
          {err("name")}
        </div>
        <div>
          <Label htmlFor="email">Email <span className="text-[#B91C1C]" aria-hidden>*</span></Label>
          <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="name@company.com" className="mt-1.5 h-11" required {...register("email")} {...field("email")} />
          {err("email")}
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+251 911 123456" className="mt-1.5 h-11" {...register("phone")} {...field("phone")} />
          {err("phone")}
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" autoComplete="organization" placeholder="Company name" className="mt-1.5 h-11" {...register("company")} />
        </div>
      </div>
      <div>
        <Label htmlFor="subject">Subject</Label>
        <select id="subject" className="mt-1.5 h-11 w-full border border-[#878F9D] bg-white px-3.5 text-[16px]" {...register("subject")}>
          <option value="General enquiry">General enquiry</option>
          {SUBJECTS.filter((s) => s.value !== "General").map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {product ? (
        <div className="flex items-center justify-between gap-3 bg-[#E0E7FF] px-3.5 py-2.5 text-[#2F447D]">
          <span className="text-sm">Inquiry about: <strong>{product.replace(/-/g, " ")}</strong></span>
          <button type="button" onClick={() => setProduct("")} className="inline-flex size-8 items-center justify-center hover:bg-white/60" aria-label="Remove product from this enquiry"><X aria-hidden className="size-4" /></button>
        </div>
      ) : null}
      <div>
        <Label htmlFor="message">Message <span className="text-[#B91C1C]" aria-hidden>*</span></Label>
        <Textarea id="message" rows={6} placeholder="Tell us which machine, part or service you need." className="mt-1.5 min-h-36" required {...register("message")} {...field("message")} />
        <div className="mt-1 flex justify-between text-xs text-[#4B5563]"><span>{err("message")}</span><span>{(form.watch("message") ?? "").length} / 5000</span></div>
      </div>
      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-[#374151]">
          <input type="checkbox" className="mt-1 size-5 accent-[#2F447D]" {...register("consent")} aria-invalid={Boolean(errors.consent) || undefined} />
          <span>I agree to the processing of my data to answer this enquiry. See the <Link href="/privacy-policy" className="underline">privacy policy</Link>.</span>
        </label>
        {err("consent")}
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>Leave this field empty<input tabIndex={-1} autoComplete="off" {...register("website")} /></label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={pending} disabled={pending} className={cn("w-full sm:w-auto")}>
          Send Message<Send aria-hidden className="size-5" />
        </Button>
        <p className="text-sm text-[#4B5563]">We use your details only to reply to this enquiry.</p>
      </div>
    </form>
  );
}
