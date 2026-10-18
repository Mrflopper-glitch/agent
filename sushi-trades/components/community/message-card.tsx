"use client";

import { motion } from "motion/react";
import { Forward, Hash, Heart, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { timeAgo } from "@/lib/format";
import type { Message, Trade, Trader } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useClock } from "@/state/app-state";
import { useSeries } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { Avatar } from "../ui/avatar";

/** One Discord message. Trade alerts get a little chart of the symbol underneath. */
export function MessageCard({
  message,
  trader,
  trade,
  showChannel = false,
}: {
  message: Message;
  trader: Trader | undefined;
  trade?: Trade;
  showChannel?: boolean;
}) {
  const { now } = useClock();
  const [liked, setLiked] = useState(false);

  return (
    <article className="flex gap-3 py-3">
      <Link href={`/traders/${message.traderId}`}>
        <Avatar trader={trader} size={34} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[13px]">
          <Link href={`/traders/${message.traderId}`} className="font-bold hover:underline">
            @{trader?.handle ?? message.traderId}
          </Link>
          <span className="text-xs text-faint">{timeAgo(message.postedAt, now)}</span>
          {showChannel && (
            <span className="flex items-center text-xs text-faint">
              <Hash className="size-3" />
              {message.channel}
            </span>
          )}
          {message.source === "discord" && <span className="rounded bg-[#5865f2]/10 px-1.5 text-[10px] font-semibold text-[#5865f2]">Discord</span>}
        </p>
        <p className={cn("mt-0.5 text-[13px] leading-relaxed break-words", trade && "font-medium")}>{message.content}</p>
        {trade && <TradeChart symbol={trade.symbol} />}
        <div className="mt-2 flex items-center gap-6 text-xs text-ink/70">
          <motion.button whileTap={{ scale: 0.8 }} onClick={() => setLiked(!liked)} aria-pressed={liked} className="flex items-center gap-1.5 tabular">
            <Heart className={cn("size-[15px]", liked ? "fill-down text-down" : "fill-down/90 text-down")} /> {message.likes + (liked ? 1 : 0)}
          </motion.button>
          <span className="flex items-center gap-1.5 tabular">
            <MessageCircle className="size-[15px]" /> {message.replies}
          </span>
          <span className="flex items-center gap-1.5">
            <Forward className="size-[15px]" /> Share
          </span>
        </div>
      </div>
    </article>
  );
}

function TradeChart({ symbol }: { symbol: string }) {
  const series = useSeries(symbol, "1W");
  return <Sparkline values={series} className="mt-2 h-10 w-full" />;
}
