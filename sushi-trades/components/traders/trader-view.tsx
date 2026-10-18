"use client";

import { motion } from "motion/react";
import { ArrowLeft, Copy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { count, moneyCompact, moneyWhole, percent, shortDate } from "@/lib/format";
import { dayStart } from "@/lib/market/time";
import { periodReturn } from "@/lib/sim/portfolio";
import { byCloseDate, isOpen } from "@/lib/trades";
import { useData } from "@/state/app-state";
import { useTrader } from "@/state/derived";
import { setSim, usePrefs } from "@/state/prefs";
import { AreaChart } from "../charts/area-chart";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { appear } from "../ui/motion";
import { StatTile } from "../ui/stat-tile";
import { Tabs } from "../ui/tabs";
import { MessageCard } from "../community/message-card";
import { TradeTable } from "../trades/trade-table";
import { FollowButton } from "./follow-button";

const RANGES = ["1M", "3M", "1Y", "All"] as const;
type ChartRange = (typeof RANGES)[number];
const RANGE_DAYS: Record<ChartRange, number | null> = { "1M": 30, "3M": 91, "1Y": 365, All: null };

/** A trader's profile: stats, account curve, open positions, history and recent messages. */
export function TraderView({ traderId }: { traderId: string }) {
  const row = useTrader(traderId);
  const { trades, messages, traders } = useData();
  const { sim } = usePrefs();
  const [range, setRange] = useState<ChartRange>("3M");

  const theirTrades = useMemo(() => trades.filter((t) => t.traderId === traderId).sort((a, b) => b.openedAt - a.openedAt), [trades, traderId]);
  const theirMessages = useMemo(() => messages.filter((m) => m.traderId === traderId).slice(0, 6), [messages, traderId]);

  if (!row) {
    return (
      <Card className="mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-lg font-bold">No trader called “{traderId}”</p>
        <p className="mt-1 text-sm text-muted">They&apos;ll appear here as soon as they post in Discord.</p>
        <Link href="/traders" className="mt-4 inline-block text-sm font-semibold text-up">
          ← All traders
        </Link>
      </Card>
    );
  }

  const { trader, stats, snapshot } = row;
  const days = RANGE_DAYS[range];
  const points = days === null ? snapshot.points : snapshot.points.slice(-days - 1);
  const copying = sim.traderIds === null || sim.traderIds.includes(trader.id);

  function toggleCopy() {
    const everyone = traders.map((t) => t.id);
    const current = sim.traderIds ?? everyone;
    setSim({ traderIds: copying ? current.filter((id) => id !== trader.id) : [...current, trader.id] });
  }

  return (
    <div className="space-y-4">
      <motion.div {...appear()}>
        <Link href="/traders" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Traders
        </Link>
      </motion.div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar trader={trader} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight">@{trader.handle}</h1>
            <p className="text-sm text-muted">
              {trader.name} · {count(trader.followers)} followers
            </p>
            <p className="mt-2 max-w-xl text-sm">{trader.bio}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trader.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-track px-2 py-0.5 text-xs font-medium text-ink/70">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <FollowButton traderId={trader.id} className="h-10 px-4" />
            <Button variant={copying ? "secondary" : "primary"} onClick={toggleCopy}>
              <Copy className="size-4" /> {copying ? "Copying in simulator" : "Copy in simulator"}
            </Button>
          </div>
        </div>
      </Card>

      <motion.div {...appear(1)} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total return" value={percent(snapshot.totalReturn, 1)} tone={snapshot.totalReturn} note="on a $100k account" />
        <StatTile label="This month" value={percent(periodReturn(snapshot.points, 30), 1)} tone={periodReturn(snapshot.points, 30)} />
        <StatTile label="Win rate" value={`${Math.round(stats.winRate * 100)}%`} note={`${stats.wins} of ${stats.closedTrades} closed`} />
        <StatTile label="Avg win / loss" value={`${percent(stats.avgWin, 0)} / ${percent(stats.avgLoss, 0)}`} />
        <StatTile label="Best trade" value={percent(stats.bestReturn, 0)} tone={stats.bestReturn} />
        <StatTile label="Max drawdown" value={`-${(snapshot.maxDrawdown * 100).toFixed(1)}%`} note="worst dip from a high" />
      </motion.div>

      <Card className="p-4" index={2}>
        <CardHeader title={`$100k copying @${trader.handle}`}>
          <Tabs tabs={RANGES} value={range} onChange={setRange} variant="soft" className="ml-auto" />
        </CardHeader>
        <p className="mt-1 text-2xl font-extrabold tracking-tight tabular">{moneyWhole(snapshot.equity)}</p>
        <AreaChart
          className="mt-3"
          data={points.map((p) => ({ x: dayStart(p.day), y: p.equity }))}
          formatValue={moneyCompact}
          formatLabel={shortDate}
          markers={[{ value: 100_000, label: "Start $100K" }]}
          revealKey={range}
          height={240}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4" index={3}>
            <CardHeader title="Open positions" className="mb-2" />
            <TradeTable trades={theirTrades.filter(isOpen)} empty="No open positions right now." />
          </Card>
          <Card className="p-4" index={4}>
            <CardHeader title="Trade history" className="mb-2" />
            <TradeTable trades={byCloseDate(theirTrades).slice(0, 25)} empty="No closed trades yet." />
          </Card>
        </div>
        <Card className="h-fit p-4" index={5}>
          <CardHeader title="Recent messages" />
          <div className="divide-y divide-line">
            {theirMessages.map((message) => (
              <MessageCard key={message.id} message={message} trader={trader} showChannel />
            ))}
            {theirMessages.length === 0 && <p className="py-6 text-center text-sm text-muted">No recent messages.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
