"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { tradeEvents } from "@/lib/feed";
import { timeAgoLong } from "@/lib/format";
import { useClock, useData } from "@/state/app-state";
import { updatePrefs, usePrefs } from "@/state/prefs";
import { Avatar } from "../ui/avatar";
import { EventSentence } from "../trades/event-sentence";

/** The bell: the latest trade calls, with a count of ones you haven't seen. */
export function Notifications() {
  const { trades, tradersById } = useData();
  const { now } = useClock();
  const { seenUntil } = usePrefs();
  const [open, setOpen] = useState(false);
  // What counted as "seen" when the panel opened, so new items keep their dot while it's open.
  const [seenAtOpen, setSeenAtOpen] = useState(seenUntil);
  const panel = useRef<HTMLDivElement>(null);

  const latest = useMemo(() => tradeEvents(trades).slice(0, 8), [trades]);
  const unread = latest.filter((event) => event.at > seenUntil).length;

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    setOpen(!open);
    if (!open) {
      setSeenAtOpen(seenUntil);
      updatePrefs((prefs) => ({ ...prefs, seenUntil: Math.max(now, latest[0]?.at ?? 0) }));
    }
  }

  return (
    <div ref={panel} className="relative">
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}
        className="relative flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-track"
      >
        <Bell className="size-[21px]" strokeWidth={1.9} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white ring-2 ring-canvas"
            >
              {unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute top-full right-0 z-50 mt-2 w-[340px] origin-top-right rounded-2xl border border-line bg-surface p-2 shadow-lift"
          >
            <div className="flex items-center justify-between px-2.5 py-2">
              <p className="text-sm font-bold">Latest calls</p>
              <Link href="/trades" onClick={() => setOpen(false)} className="text-xs font-semibold text-up">
                View all
              </Link>
            </div>
            {latest.length === 0 && <p className="px-2.5 py-4 text-sm text-muted">No trades yet. They show up here the moment they hit Discord.</p>}
            {latest.map((event) => (
              <Link
                key={event.key}
                href={`/traders/${event.trade.traderId}`}
                onClick={() => setOpen(false)}
                className="flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-track"
              >
                <Avatar trader={tradersById.get(event.trade.traderId)} size={32} />
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  <EventSentence event={event} trader={tradersById.get(event.trade.traderId)} />
                  <p className="mt-0.5 text-xs text-faint">{timeAgoLong(event.at, now)}</p>
                </div>
                {event.at > seenAtOpen && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
