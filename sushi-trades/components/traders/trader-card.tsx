"use client";

import Link from "next/link";
import { count, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TraderRow } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { Avatar } from "../ui/avatar";
import { Change } from "../ui/numbers";
import { FollowButton } from "./follow-button";

const MEDALS = ["bg-amber-400 text-amber-950", "bg-zinc-300 text-zinc-800", "bg-orange-300 text-orange-950"];

/** A leaderboard card: rank, trader, their return for the period, and their account curve. */
export function TraderCard({ row, rank, periodReturn, days }: { row: TraderRow; rank: number; periodReturn: number; days: number | null }) {
  const { trader, stats, snapshot } = row;
  const curve = (days === null ? snapshot.points : snapshot.points.slice(-days - 1)).map((p) => p.equity);

  return (
    <Link
      href={`/traders/${trader.id}`}
      className="group block h-full rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar trader={trader} size={44} />
          <span
            className={cn(
              "absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-surface",
              MEDALS[rank - 1] ?? "bg-track text-ink",
            )}
          >
            {rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">@{trader.handle}</p>
          <p className="truncate text-xs text-muted">
            {trader.name} · {count(trader.followers)} followers
          </p>
        </div>
        <FollowButton traderId={trader.id} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <Change value={periodReturn} digits={1} className="text-2xl tracking-tight" />
          <p className="text-xs text-muted">return on a $100k account</p>
        </div>
        <div className="flex gap-1">
          {trader.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-md bg-track px-2 py-0.5 text-[11px] font-medium text-ink/70">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <Sparkline values={curve} className="mt-3 h-14 w-full" />

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
        <div>
          <dt className="text-muted">Win rate</dt>
          <dd className="font-semibold tabular">{Math.round(stats.winRate * 100)}%</dd>
        </div>
        <div>
          <dt className="text-muted">Trades</dt>
          <dd className="font-semibold tabular">{stats.totalTrades}</dd>
        </div>
        <div>
          <dt className="text-muted">Avg win</dt>
          <dd className="font-semibold text-up tabular">{percent(stats.avgWin, 1)}</dd>
        </div>
      </dl>
    </Link>
  );
}
