"use client";

import { Eye } from "lucide-react";
import { hashString } from "@/lib/market/random";
import { count } from "@/lib/format";
import { useClock, useData } from "@/state/app-state";
import { useSeries } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { ButtonLink } from "../ui/button";
import { Card, CardHeader } from "../ui/card";

/** Where "Join" goes. Set NEXT_PUBLIC_DISCORD_INVITE_URL to your server's invite link. */
const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "/community";

/** "Live on Sushi": the stream happening right now, with a live chart on its screen. */
export function LiveCard() {
  const { now } = useClock();
  const { tradersById } = useData();
  const spy = useSeries("SPY", "1D");
  const qqq = useSeries("QQQ", "1D");
  const host = tradersById.get("alextrades");

  // Viewer count drifts a little every few seconds.
  const viewers = 1150 + (hashString(String(Math.floor(now / 10_000))) % 140);

  return (
    <Card className="p-4" index={1}>
      <CardHeader title="Live on Sushi" href="/community" />
      <div className="relative mt-3 h-[130px] overflow-hidden rounded-xl bg-[#0d2332]">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_23px,rgb(255_255_255/0.04)_24px),linear-gradient(90deg,transparent_23px,rgb(255_255_255/0.04)_24px)] bg-[size:24px_24px]" />
        <Sparkline values={qqq} className="absolute inset-x-3 top-10 h-[70px] w-[calc(100%-1.5rem)] opacity-40" color="#38bdf8" fill={false} />
        <Sparkline values={spy} className="absolute inset-x-3 top-8 h-[80px] w-[calc(100%-1.5rem)]" color="#22e07a" />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 rounded-md bg-[#ef2b2d] px-2 py-0.5 text-[11px] font-bold text-white">
            <span className="live-dot size-1.5 rounded-full bg-white" /> LIVE
          </span>
          <span className="flex items-center gap-1 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white tabular">
            <Eye className="size-3" /> {count(viewers)}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">Morning Market Breakdown</p>
          <p className="text-[13px] text-muted">@{host?.handle ?? "AlexTrades"}</p>
        </div>
        <ButtonLink href={DISCORD_INVITE} size="sm" className="px-5">
          Join
        </ButtonLink>
      </div>
    </Card>
  );
}
