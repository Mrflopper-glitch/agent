"use client";

import { motion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleWatch, usePrefs } from "@/state/prefs";

/** The star that adds or removes a symbol from your watchlist. It pops when tapped. */
export function WatchStar({ symbol, className }: { symbol: string; className?: string }) {
  const { watchlist } = usePrefs();
  const on = watchlist.includes(symbol);
  return (
    <motion.button
      whileTap={{ scale: 0.75 }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWatch(symbol);
      }}
      aria-label={on ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      aria-pressed={on}
      className={cn("rounded-md p-1 transition-colors hover:bg-track", className)}
    >
      <Star className={cn("size-[18px] transition-colors", on ? "fill-brand text-brand" : "text-ink/60")} strokeWidth={1.8} />
    </motion.button>
  );
}
