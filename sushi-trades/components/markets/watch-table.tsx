"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { price } from "@/lib/format";
import { getTicker } from "@/lib/market/tickers";
import { useQuote, useSeries } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { TickerIcon } from "../ui/avatar";
import { listItem } from "../ui/motion";
import { Change, LivePrice } from "../ui/numbers";
import { WatchStar } from "./watch-star";

/** A table of symbols with live prices, today's change and a 1-day chart. Rows open the symbol's page. */
export function WatchTable({ symbols, showName = false }: { symbols: string[]; showName?: boolean }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="pb-2 font-medium">Symbol</th>
          <th className="pb-2 font-medium">Price</th>
          <th className="pb-2 font-medium">24h %</th>
          <th className="hidden pb-2 font-medium sm:table-cell">Chart</th>
          <th className="w-8 pb-2" />
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {symbols.map((symbol) => (
            <WatchRow key={symbol} symbol={symbol} showName={showName} />
          ))}
        </AnimatePresence>
      </tbody>
    </table>
  );
}

function WatchRow({ symbol, showName }: { symbol: string; showName: boolean }) {
  const router = useRouter();
  const quote = useQuote(symbol);
  const series = useSeries(symbol, "1D");

  return (
    <motion.tr
      layout
      {...listItem}
      onClick={() => router.push(`/markets/${symbol}`)}
      className="cursor-pointer border-t border-line transition-colors hover:bg-track/60"
    >
      <td className="py-2.5 pr-2">
        <span className="flex items-center gap-2.5">
          <TickerIcon symbol={symbol} size={26} />
          <span>
            <span className="block font-bold">{symbol}</span>
            {showName && <span className="block text-xs text-muted">{getTicker(symbol).name}</span>}
          </span>
        </span>
      </td>
      <td className="py-2.5 pr-2 font-medium">
        <LivePrice value={quote.price} format={(v) => "$" + price(v)} />
      </td>
      <td className="py-2.5 pr-2">
        <Change value={quote.change} />
      </td>
      <td className="hidden py-2.5 pr-2 sm:table-cell">
        <Sparkline values={series} className="h-7 w-14" fill={false} />
      </td>
      <td className="py-2.5 pl-1 text-right">
        <WatchStar symbol={symbol} />
      </td>
    </motion.tr>
  );
}
