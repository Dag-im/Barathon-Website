import Link from "next/link";
import { cn } from "@/lib/utils";

/** Vector logo (design 4.9). Served as SVG, so no image optimisation. */
export function Logo({ variant = "full", tone = "color", className, href = "/" }: { variant?: "full" | "mark"; tone?: "color" | "white"; className?: string; href?: string | null }) {
  const src = variant === "mark" ? (tone === "white" ? "/brand/logo-mark-white.svg" : "/brand/logo-mark.svg") : tone === "white" ? "/brand/logo-full-white.svg" : "/brand/logo-full.svg";
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Baraton Group Co." className={cn("h-11 w-auto", className)} width={variant === "mark" ? 222 : 720} height={212} />
  );
  return href ? <Link href={href} className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2">{img}</Link> : img;
}
