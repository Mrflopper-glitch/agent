"use client";

import Link from "next/link";
import { price } from "@/lib/format";
import { getTicker } from "@/lib/market/tickers";
import { seriesChange, useSeries, type Range } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { Change, LivePrice } from "../ui/numbers";

/** One market in a small box: name, live price, change over the range, and a trend line. */
export function MarketTile({ symbol, range }: { symbol: string; range: Range }) {
  const ticker = getTicker(symbol);
  const series = useSeries(symbol, range);

  return (
    <Link
      href={`/markets/${symbol}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <p className="truncate text-xs font-medium text-ink/80">{ticker.kind === "index" ? ticker.name.toUpperCase() : symbol}</p>
      <p className="mt-0.5 text-sm font-bold">
        <LivePrice value={series[series.length - 1]} format={price} />
      </p>
      <Change value={seriesChange(series)} className="text-[13px]" />
      <Sparkline values={series} className="mt-2 min-h-10 w-full flex-1" />
    </Link>
  );
}
