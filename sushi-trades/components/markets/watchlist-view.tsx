"use client";

import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { TICKERS } from "@/lib/market/tickers";
import { isOpen } from "@/lib/trades";
import { useData } from "@/state/app-state";
import { toggleWatch, usePrefs } from "@/state/prefs";
import { TickerIcon } from "../ui/avatar";
import { Card, CardHeader } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { TradeTable } from "../trades/trade-table";
import { WatchTable } from "./watch-table";

/** Your watchlist, plus which of your traders are in those names right now. */
export function WatchlistView() {
  const { watchlist } = usePrefs();
  const { trades } = useData();
  const notWatched = TICKERS.filter((t) => !watchlist.includes(t.symbol));
  const positions = trades.filter((t) => isOpen(t) && watchlist.includes(t.symbol)).sort((a, b) => b.openedAt - a.openedAt);

  return (
    <>
      <PageHeader title="Watchlist" subtitle="The symbols you care about, and who's trading them." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <CardHeader title={`Watching ${watchlist.length}`} className="mb-3" />
            {watchlist.length ? (
              <WatchTable symbols={watchlist} showName />
            ) : (
              <p className="py-8 text-center text-sm text-muted">Your watchlist is empty. Add symbols on the right.</p>
            )}
          </Card>
          <Card className="p-4" index={1}>
            <CardHeader title="Your traders in these names" className="mb-2" />
            <TradeTable trades={positions} showTrader empty="None of your traders hold these symbols right now." />
          </Card>
        </div>
        <Card className="h-fit p-4" index={2}>
          <CardHeader title="Add symbols" />
          <div className="mt-3 flex flex-wrap gap-2">
            {notWatched.map((ticker) => (
              <motion.button
                key={ticker.symbol}
                layout
                whileTap={{ scale: 0.92 }}
                onClick={() => toggleWatch(ticker.symbol)}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-xs font-semibold transition-colors hover:border-brand/40 hover:bg-brand-soft"
              >
                <TickerIcon symbol={ticker.symbol} size={20} className="rounded-full" />
                {ticker.symbol}
                <Plus className="size-3 text-faint" />
              </motion.button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
