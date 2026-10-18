"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { closeOn } from "@/lib/market/prices";
import { TICKERS } from "@/lib/market/tickers";
import { useClock } from "@/state/app-state";
import { RANGES, type Range } from "@/state/derived";
import { Card } from "../ui/card";
import { Tabs } from "../ui/tabs";
import { MarketTile } from "../markets/market-tile";

const VIEWS = ["Indices", "Crypto", "Top Movers"] as const;
type View = (typeof VIEWS)[number];

/** Market Overview: five live tiles, switchable between indices, crypto and today's biggest movers. */
export function MarketOverview() {
  const [view, setView] = useState<View>("Indices");
  const [range, setRange] = useState<Range>("1D");
  const symbols = useSymbols(view);

  return (
    <Card className="flex flex-col p-4" index={3}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="text-[17px] font-bold tracking-tight">Market Overview</h2>
        <Tabs tabs={VIEWS} value={view} onChange={setView} variant="underline" />
        <Tabs tabs={RANGES} value={range} onChange={setRange} variant="soft" className="ml-auto" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="mt-4 grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5"
        >
          {symbols.map((symbol) => (
            <MarketTile key={symbol} symbol={symbol} range={range} />
          ))}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

function useSymbols(view: View): string[] {
  const { today } = useClock();
  // Today's biggest movers (by size of move, up or down) among stocks.
  const movers = useMemo(
    () =>
      TICKERS.filter((t) => t.kind === "stock")
        .map((t) => ({ symbol: t.symbol, move: Math.abs(closeOn(t.symbol, today) / closeOn(t.symbol, today - 1) - 1) }))
        .sort((a, b) => b.move - a.move)
        .slice(0, 5)
        .map((t) => t.symbol),
    [today],
  );

  if (view === "Indices") return ["SPX", "IXIC", "DJI", "BTC", "ETH"];
  if (view === "Crypto") return ["BTC", "ETH", "SOL", "XRP", "DOGE"];
  return movers;
}
