import { cn } from "@/lib/utils";

/** Section kicker with the burgundy tick (design 4.10.4). */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}
