"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-site flex flex-col items-start gap-4 py-24">
      <AlertTriangle aria-hidden className="size-8 text-[#B45309]" strokeWidth={1.5} />
      <h1 className="t-h1 text-foreground">Something went wrong</h1>
      <p className="max-w-[56ch] text-[#4B5563]">The page could not be loaded. Try again, or call us on +251 911 514558 if the problem continues.</p>
      {error.digest ? <p className="text-xs text-[#6B7280]">Reference: {error.digest}</p> : null}
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
