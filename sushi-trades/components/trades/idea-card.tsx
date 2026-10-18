"use client";

import { motion } from "motion/react";
import { Bookmark, Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { percent } from "@/lib/format";
import { expectedMove } from "@/lib/ideas";
import { isBullish, markPrice, tradeReturn } from "@/lib/trades";
import type { Trade, Trader } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useClock, usePrices } from "@/state/app-state";
import { useSeries } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { Avatar } from "../ui/avatar";

/** One trade idea: who posted it, how far they think it can go, and a chart of the underlying. */
export function IdeaCard({ trade, trader }: { trade: Trade; trader: Trader | undefined }) {
  const { now } = useClock();
  const { priceOf } = usePrices();
  const series = useSeries(trade.symbol, "1M");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const move = expectedMove(trade);
  const soFar = tradeReturn(trade, markPrice(trade, priceOf(trade.symbol), now));
  const tags = [trader?.tags[0], trade.option ? "Options" : trade.assetClass === "crypto" ? "Crypto" : "Stock"].filter(
    (tag, i, all): tag is string => !!tag && all.indexOf(tag) === i,
  );

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-3 transition-shadow duration-300 hover:shadow-lift">
      <Link href={`/traders/${trade.traderId}`} className="flex items-center gap-2.5">
        <Avatar trader={trader} size={30} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold">{trade.title ?? trade.symbol}</span>
          <span className="block truncate text-xs text-faint">@{trader?.handle}</span>
        </span>
      </Link>

      <p className="mt-3 truncate text-xs">
        {move !== null ? (
          <>
            <span className={cn("font-bold tabular", move >= 0 ? "text-up" : "text-down")}>{percent(move, 1)}</span>{" "}
            <span className="text-ink/80">expected move</span>
          </>
        ) : (
          <>
            <span className={cn("font-bold tabular", soFar >= 0 ? "text-up" : "text-down")}>{percent(soFar, 1)}</span>{" "}
            <span className="text-ink/80">so far</span>
          </>
        )}
      </p>

      <Sparkline values={series} className="mt-2 h-12 w-full" color={isBullish(trade) ? undefined : "var(--down)"} />

      <div className="mt-3 flex items-center gap-1">
        {tags.slice(0, 2).map((tag, i) => (
          <span key={tag} className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", i === 0 ? "bg-sky-50 text-sky-700" : "bg-track text-ink/70")}>
            {tag}
          </span>
        ))}
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => setLiked(!liked)}
          aria-pressed={liked}
          aria-label="Like"
          className="ml-auto flex items-center gap-1 text-xs text-ink/70 tabular"
        >
          <Heart className={cn("size-3.5 transition-colors", liked && "fill-down text-down")} />
          {trade.likes + (liked ? 1 : 0)}
        </motion.button>
        <motion.button whileTap={{ scale: 0.8 }} onClick={() => setSaved(!saved)} aria-pressed={saved} aria-label="Save" className="text-ink/70">
          <Bookmark className={cn("size-3.5", saved && "fill-ink text-ink")} />
        </motion.button>
      </div>
    </div>
  );
}
