"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Hash } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCloseAlert, formatOpenAlert } from "@/lib/discord/alerts";
import type { TradeEvent } from "@/lib/feed";
import { timeAgoLong } from "@/lib/format";
import { isOpen, markPrice, tradeReturn } from "@/lib/trades";
import type { Trader } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useClock, usePrices } from "@/state/app-state";
import { useSeries } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { Avatar } from "../ui/avatar";
import { EASE } from "../ui/motion";
import { Change } from "../ui/numbers";
import { EventSentence } from "./event-sentence";

/** One row in the live trade feed. Click it to see the original Discord message and a chart. */
export function TradeEventRow({ event, trader }: { event: TradeEvent; trader: Trader | undefined }) {
  const { now } = useClock();
  const { priceOf } = usePrices();
  const [open, setOpen] = useState(false);
  const { trade } = event;

  // Open trades show how they're doing right now; closed ones show the final result.
  const stillOpen = isOpen(trade);
  const result = stillOpen ? tradeReturn(trade, markPrice(trade, priceOf(trade.symbol), now)) : tradeReturn(trade, trade.exitPrice ?? trade.entryPrice);
  const resultLabel = stillOpen ? "live" : event.kind === "close" ? "final" : "closed";

  const original = event.kind === "open" ? (trade.rawMessage ?? formatOpenAlert(trade)) : formatCloseAlert(trade);

  return (
    <div className="border-b border-line last:border-0">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-1 py-3 text-left">
        <Avatar trader={trader} size={36} />
        <div className="min-w-0 flex-1 text-[13px]">
          <EventSentence event={event} trader={trader} showReturn={false} />
          <p className="mt-0.5 flex items-center gap-2 text-xs text-faint">
            {timeAgoLong(event.at, now)}
            {trade.source === "discord" ? (
              <span className="rounded bg-[#5865f2]/10 px-1.5 text-[10px] font-semibold text-[#5865f2]">Discord</span>
            ) : (
              <span className="rounded bg-track px-1.5 text-[10px] font-semibold text-muted">Demo</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <Change value={result} digits={1} pill className="text-xs" />
          <p className="mt-1 text-[11px] text-faint">{resultLabel}</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform duration-300", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mb-3 ml-12 grid gap-3 rounded-xl bg-track/60 p-3 sm:grid-cols-[1fr_200px]">
              <div>
                <p className="flex items-center text-[11px] font-semibold text-muted">
                  <Hash className="size-3" /> trade-alerts · original message
                </p>
                <p className="mt-1 rounded-lg bg-surface px-3 py-2 font-mono text-[13px]">{original}</p>
                <Link href={`/traders/${trade.traderId}`} className="mt-2 inline-block text-xs font-semibold text-up">
                  View @{trader?.handle}&apos;s profile →
                </Link>
              </div>
              <SymbolChart symbol={trade.symbol} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SymbolChart({ symbol }: { symbol: string }) {
  const series = useSeries(symbol, "1M");
  return (
    <Link href={`/markets/${symbol}`} className="block rounded-lg bg-surface p-2">
      <p className="text-[11px] font-semibold text-muted">{symbol} · 1M</p>
      <Sparkline values={series} className="mt-1 h-12 w-full" />
    </Link>
  );
}
