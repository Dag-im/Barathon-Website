"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Web Share API with a copy-link fallback (design 6.20 share). */
export function ShareButton({ url, title, label = "Share", variant = "ghost" }: { url: string; title: string; label?: string; variant?: "ghost" | "outline" }) {
  const onClick = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url, title });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      /* user cancelled the share sheet */
    }
  };
  return (
    <Button type="button" variant={variant} size="md" onClick={onClick}>
      <Share2 aria-hidden className="size-5" />
      {label}
    </Button>
  );
}
