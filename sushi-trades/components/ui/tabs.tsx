"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { SPRING } from "./motion";

/**
 * A row of tabs whose highlight slides to the selected one.
 *
 *   underline – a green line under the active tab (Indices | Top Movers)
 *   soft      – a pale green pill (1D 1W 1M)
 *   solid     – a black pill, others grey (Trending | Options)
 *   outline   – a white pill with a green border (For You | Following)
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "soft",
  className,
  labels,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  variant?: "underline" | "soft" | "solid" | "outline";
  className?: string;
  labels?: Partial<Record<T, string>>;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn("flex items-center", variant === "underline" ? "gap-5" : "gap-1.5", className)}>
      {tabs.map((tab) => {
        const active = tab === value;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab)}
            className={cn(
              "relative shrink-0 whitespace-nowrap text-[13px] font-medium transition-colors",
              variant === "underline" && "pb-1.5",
              variant === "soft" && "rounded-lg px-2 py-1 text-xs",
              variant === "solid" && "rounded-lg bg-track px-3.5 py-1.5",
              variant === "outline" && "flex-1 rounded-xl px-3 py-1.5",
              active ? (variant === "solid" ? "text-white" : "text-ink") : "text-muted hover:text-ink",
              active && variant === "soft" && "text-up",
            )}
          >
            {active && (
              <motion.span
                layoutId={id}
                transition={SPRING}
                className={cn(
                  "absolute",
                  variant === "underline" && "inset-x-0 -bottom-px h-0.5 rounded-full bg-ink",
                  variant === "soft" && "inset-0 rounded-lg bg-brand-soft",
                  variant === "solid" && "inset-0 rounded-lg bg-ink",
                  variant === "outline" && "inset-0 rounded-xl border border-brand/50 bg-brand-soft/60",
                )}
              />
            )}
            <span className="relative">{labels?.[tab] ?? tab}</span>
          </button>
        );
      })}
    </div>
  );
}
