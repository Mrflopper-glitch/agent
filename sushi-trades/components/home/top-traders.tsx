"use client";

import { motion } from "motion/react";
import { Crown } from "lucide-react";
import Link from "next/link";
import { periodReturn } from "@/lib/sim/portfolio";
import { useTraderBoard } from "@/state/derived";
import { Avatar } from "../ui/avatar";
import { Card, CardHeader } from "../ui/card";
import { SPRING } from "../ui/motion";
import { Change } from "../ui/numbers";

/** "Top Traders This Week": the five best 7-day returns. Rows glide when the order changes. */
export function TopTraders() {
  const board = useTraderBoard();
  const ranked = board
    .map((row) => ({ ...row, week: periodReturn(row.snapshot.points, 7) }))
    .sort((a, b) => b.week - a.week)
    .slice(0, 5);

  return (
    <Card className="p-4" index={2}>
      <CardHeader title="Top Traders This Week" href="/traders" />
      <ol className="mt-2">
        {ranked.map(({ trader, week }, i) => (
          <motion.li key={trader.id} layout transition={SPRING} className="border-b border-line last:border-0">
            <Link href={`/traders/${trader.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-track/70">
              <span className="flex w-5 justify-center text-sm font-semibold">
                {i === 0 ? <Crown className="size-[18px] fill-amber-400 text-amber-500" /> : <span className={i === 2 ? "text-orange-500" : ""}>{i + 1}</span>}
              </span>
              <Avatar trader={trader} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">@{trader.handle}</span>
              <Change value={week} digits={1} className="text-sm" />
            </Link>
          </motion.li>
        ))}
      </ol>
    </Card>
  );
}
