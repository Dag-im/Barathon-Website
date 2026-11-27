import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

/** Empty state (design 6.18): icon, title, description and optional action. */
export function StatusEmpty({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center px-6 py-16 text-center">
      <Icon aria-hidden className="size-8 text-[#6B7280]" strokeWidth={1.5} />
      <h2 className="t-h3 mt-4 text-foreground" style={{ fontSize: 24, lineHeight: "30px" }}>{title}</h2>
      {description ? <p className="mt-2 text-[#4B5563]">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
