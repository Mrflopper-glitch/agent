"use client";

import Link from "next/link";
import { price, shortDate, timeAgoLong } from "@/lib/format";
import { describeInstrument, isBullish, isOpen, markPrice, openVerb, tradeReturn } from "@/lib/trades";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useClock, useData, usePrices } from "@/state/app-state";
import { Avatar } from "../ui/avatar";
import { Change, LivePrice } from "../ui/numbers";

/**
 * A table of trades. Open trades show their live price and running return;
 * closed trades show the exit and final return.
 */
export function TradeTable({ trades, showTrader = false, empty }: { trades: Trade[]; showTrader?: boolean; empty: string }) {
  if (trades.length === 0) return <p className="py-8 text-center text-sm text-muted">{empty}</p>;

  return (
    <div className="scroll-quiet -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="text-left text-xs text-muted">
            {showTrader && <th className="pb-2 font-medium">Trader</th>}
            <th className="pb-2 font-medium">Trade</th>
            <th className="pb-2 text-right font-medium">Entry</th>
            <th className="pb-2 text-right font-medium">{trades.some(isOpen) ? "Now" : "Exit"}</th>
            <th className="pb-2 text-right font-medium">Return</th>
            <th className="pb-2 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} showTrader={showTrader} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeRow({ trade, showTrader }: { trade: Trade; showTrader: boolean }) {
  const { now } = useClock();
  const { priceOf } = usePrices();
  const { tradersById } = useData();
  const open = isOpen(trade);
  const current = open ? markPrice(trade, priceOf(trade.symbol), now) : (trade.exitPrice ?? trade.entryPrice);
  const trader = tradersById.get(trade.traderId);

  return (
    <tr className="border-t border-line">
      {showTrader && (
        <td className="py-2.5 pr-3">
          <Link href={`/traders/${trade.traderId}`} className="flex items-center gap-2 font-medium hover:underline">
            <Avatar trader={trader} size={24} />@{trader?.handle}
          </Link>
        </td>
      )}
      <td className="py-2.5 pr-3">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
              isBullish(trade) ? "bg-brand-soft text-up" : "bg-down-soft text-down",
            )}
          >
            {openVerb(trade)}
          </span>
          <Link href={`/markets/${trade.symbol}`} className="font-semibold hover:underline">
            {describeInstrument(trade)}
          </Link>
          {trade.size !== 1 && <span className="text-[11px] text-muted">{trade.size === 0.25 ? "lotto" : `${trade.size}× size`}</span>}
          {trade.source === "discord" && <span className="rounded bg-[#5865f2]/10 px-1.5 text-[10px] font-semibold text-[#5865f2]">Discord</span>}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right tabular">{price(trade.entryPrice)}</td>
      <td className="py-2.5 pr-3 text-right">{open ? <LivePrice value={current} format={price} /> : <span className="tabular">{price(current)}</span>}</td>
      <td className="py-2.5 pr-3 text-right">
        <Change value={tradeReturn(trade, current)} digits={1} />
      </td>
      <td className="py-2.5 text-right text-xs text-muted">
        {open ? timeAgoLong(trade.openedAt, now) : shortDate(trade.closedAt ?? trade.openedAt)}
      </td>
    </tr>
  );
}
