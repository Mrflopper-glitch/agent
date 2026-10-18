"use client";

import { motion } from "motion/react";
import { longDate, moneyCompact } from "@/lib/format";
import { DAY_MS } from "@/lib/market/time";
import type { GoalProjection } from "@/lib/sim/portfolio";
import { cn } from "@/lib/utils";
import { useClock } from "@/state/app-state";
import { EASE } from "../ui/motion";

export const GOAL = 1_000_000;
const MILESTONES = [100_000, 250_000, 500_000, GOAL];

/** The bar that fills up toward $1,000,000, with milestone markers and a "when will I get there" estimate. */
export function GoalProgress({ equity, projection }: { equity: number; projection: GoalProjection }) {
  const { now } = useClock();
  const progress = Math.min(1, equity / GOAL);

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold">Road to 7 figures</span>
        <span className="text-muted tabular">{(progress * 100).toFixed(1)}% of $1M</span>
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-track">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand to-[#3ee38a]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(progress * 100, 1.5)}%` }}
          transition={{ duration: 1.2, ease: EASE }}
        />
        {MILESTONES.map((value) => (
          <span
            key={value}
            className={cn(
              "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface transition-colors duration-500",
              equity >= value ? "bg-brand" : "bg-line",
            )}
            style={{ left: `${(value / GOAL) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted">
        {MILESTONES.map((value) => (
          <span key={value} className="absolute -translate-x-1/2 last:-translate-x-full" style={{ left: `${(value / GOAL) * 100}%` }}>
            {moneyCompact(value)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-ink/80">{describe(projection, now)}</p>
    </div>
  );
}

function describe(projection: GoalProjection, now: number): string {
  if (projection.reached) return "You've reached 7 figures. Time to set a bigger goal.";
  if (projection.daysToGoal === null) return "Not on pace for $1M yet. Try different traders or a different position size.";
  const years = projection.daysToGoal / 365;
  const when = longDate(now + projection.daysToGoal * DAY_MS);
  const pace = `${projection.yearlyGrowth >= 0 ? "+" : ""}${Math.round(projection.yearlyGrowth * 100)}% a year`;
  const howLong = years < 1 ? `${Math.max(1, Math.round(projection.daysToGoal / 30))} months` : `${years.toFixed(1)} years`;
  return `At this pace (${pace}) you'd hit $1M in about ${howLong}, around ${when}.`;
}
