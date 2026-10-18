import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A small labelled number, e.g. "Win rate · 64%". `tone` colors it green/red by sign. */
export function StatTile({
  label,
  value,
  note,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-3.5", className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tracking-tight tabular", tone !== undefined && (tone >= 0 ? "text-up" : "text-down"))}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}
