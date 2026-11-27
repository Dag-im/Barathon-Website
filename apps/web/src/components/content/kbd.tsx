import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 items-center rounded-sm border border-[#D1D5DB] bg-[#F1F3F5] px-1.5 font-sans text-xs font-medium text-[#374151]", className)}>
      {children}
    </kbd>
  );
}
