"use client";

import { AnimatePresence, motion } from "motion/react";
import { Radio, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tradeEvents, type TradeEvent } from "@/lib/feed";
import type { Trader } from "@/lib/types";
import { useClock, useData } from "@/state/app-state";
import { Avatar } from "../ui/avatar";
import { listItem } from "../ui/motion";
import { EventSentence } from "../trades/event-sentence";

const SHOW_FOR_MS = 7000;

/** Pops up a card in the corner whenever a trader opens or closes a trade while you're watching. */
export function TradeToasts() {
  const { trades, tradersById } = useData();
  const { now } = useClock();
  // Only events that happen after the page opened become toasts.
  const [openedAt] = useState(now);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const toasts = useMemo(
    () => tradeEvents(trades).filter((e) => e.at > openedAt && !dismissed.has(e.key)).slice(0, 3),
    [trades, openedAt, dismissed],
  );

  const dismiss = useCallback((key: string) => {
    setDismissed((previous) => new Set(previous).add(key));
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((event) => (
          <Toast key={event.key} event={event} trader={tradersById.get(event.trade.traderId)} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ event, trader, onDismiss }: { event: TradeEvent; trader: Trader | undefined; onDismiss: (key: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(event.key), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [event.key, onDismiss]);

  return (
    <motion.div layout {...listItem} className="pointer-events-auto flex gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lift">
      <Avatar trader={trader} size={36} />
      <Link href={`/traders/${event.trade.traderId}`} className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-up uppercase">
          <Radio className="size-3" /> {event.kind === "open" ? "New trade" : "Trade closed"}
        </p>
        <EventSentence event={event} trader={trader} />
      </Link>
      <button onClick={() => onDismiss(event.key)} aria-label="Dismiss" className="self-start rounded-md p-1 text-faint hover:bg-track hover:text-ink">
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}
