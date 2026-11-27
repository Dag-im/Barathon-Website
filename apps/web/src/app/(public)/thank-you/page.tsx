import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: { absolute: "Thank you | Baraton Group Co." }, robots: { index: false, follow: false } };

export default function ThankYouPage() {
  return (
    <section className="section-lg bg-[#F8F9FA] text-center">
      <div className="container-prose flex flex-col items-center gap-6 px-4">
        <CheckCircle2 aria-hidden className="size-16 text-[#15803D]" strokeWidth={1.25} />
        <h1 className="t-h1 text-foreground">Thank you. Your message has been sent.</h1>
        <p className="t-lead max-w-[46ch] text-[#374151]">We usually reply within one business day. For urgent requests call <a href="tel:+251911514558" className="font-medium text-[#0D5380]">+251 911 514558</a>.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild><Link href="/">Back to home</Link></Button>
          <Button asChild variant="outline"><Link href="/products">Browse products</Link></Button>
        </div>
      </div>
    </section>
  );
}
