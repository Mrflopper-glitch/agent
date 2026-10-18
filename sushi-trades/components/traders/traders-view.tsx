"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { periodReturn } from "@/lib/sim/portfolio";
import { useTraderBoard } from "@/state/derived";
import { appear, SPRING } from "../ui/motion";
import { PageHeader } from "../ui/page-header";
import { Tabs } from "../ui/tabs";
import { TraderCard } from "./trader-card";

const PERIODS = ["1W", "1M", "3M", "1Y", "All"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number | null> = { "1W": 7, "1M": 30, "3M": 91, "1Y": 365, All: null };

/** The Traders leaderboard. Switching the period re-ranks the cards, and they glide into place. */
export function TradersView() {
  const board = useTraderBoard();
  const [period, setPeriod] = useState<Period>("1M");
  const days = PERIOD_DAYS[period];

  const ranked = board
    .map((row) => ({ row, value: days === null ? row.snapshot.totalReturn : periodReturn(row.snapshot.points, days) }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader title="Traders" subtitle="Everyone posting calls in your Discord, ranked by how a $100k account copying them would have done.">
        <Tabs tabs={PERIODS} value={period} onChange={setPeriod} variant="solid" />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ranked.map(({ row, value }, i) => (
          <motion.div key={row.trader.id} layout {...appear(i)} transition={{ ...appear(i).transition, layout: SPRING }}>
            <TraderCard row={row} rank={i + 1} periodReturn={value} days={days} />
          </motion.div>
        ))}
      </div>
    </>
  );
}
