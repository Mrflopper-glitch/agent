"use client";

import { motion } from "motion/react";
import { money, moneyCompact, percent, shortDate, signedMoney, signedMoneyWhole } from "@/lib/format";
import { dayStart } from "@/lib/market/time";
import { projectGoal } from "@/lib/sim/portfolio";
import { cn } from "@/lib/utils";
import { useSimulation } from "@/state/derived";
import { AreaChart } from "../charts/area-chart";
import { Card, CardHeader } from "../ui/card";
import { appear } from "../ui/motion";
import { AnimatedNumber } from "../ui/numbers";
import { PageHeader } from "../ui/page-header";
import { StatTile } from "../ui/stat-tile";
import { GOAL, GoalProgress } from "./goal-progress";
import { ClosedPositions, OpenPositions } from "./positions";
import { SimControls } from "./sim-controls";

/** The 7-Figure Simulator: your copy-trading account, its curve, and the road to $1M. */
export function PortfolioView() {
  const { settings, traderIds, snapshot } = useSimulation();
  const projection = projectGoal(snapshot.points, GOAL);
  const up = snapshot.totalPnl >= 0;
  const copied = snapshot.closed.length + snapshot.positions.length;

  return (
    <>
      <PageHeader
        title="7-Figure Simulator"
        subtitle={`What ${moneyCompact(settings.startingCash)} would be worth if you'd copied ${traderIds.length} trader${traderIds.length === 1 ? "" : "s"} at ${(settings.positionPct * 100).toFixed(1).replace(/\.0$/, "")}% per trade.`}
      />

      {/* One grid: on phones everything stacks (settings right under the balance); on wide screens settings stick to the right. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Account value</p>
              <p className="mt-1 text-[40px] leading-none font-extrabold tracking-[-0.03em]">
                <AnimatedNumber value={snapshot.equity} format={money} />
              </p>
              <p className="mt-2 text-sm">
                <span className={cn("font-semibold tabular", snapshot.dayChange >= 0 ? "text-up" : "text-down")}>
                  {signedMoney(snapshot.dayChange)} ({percent(snapshot.dayChangePct)})
                </span>{" "}
                <span className="text-muted">today</span>
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-muted">Total profit</p>
              <p className={cn("text-2xl font-bold tracking-tight tabular", up ? "text-up" : "text-down")}>{signedMoney(snapshot.totalPnl)}</p>
              <p className={cn("text-sm font-semibold tabular", up ? "text-up" : "text-down")}>{percent(snapshot.totalReturn)}</p>
            </div>
          </div>
          <div className="mt-6">
            <GoalProgress equity={snapshot.equity} projection={projection} />
          </div>
        </Card>

        <div className="space-y-4 xl:sticky xl:top-[88px] xl:col-start-2 xl:row-span-5 xl:row-start-1">
          <SimControls />
          <p className="px-1 text-xs leading-relaxed text-muted">
            Simulated results. Prices come from a simulated market until a live data feed is connected, and options use a simplified pricing model.
            Past performance doesn&apos;t guarantee future results.
          </p>
        </div>

        <Card className="min-w-0 p-4" index={1}>
          <CardHeader title="Account value over time" />
          <AreaChart
            className="mt-3"
            data={snapshot.points.map((p) => ({ x: dayStart(p.day), y: p.equity }))}
            formatValue={moneyCompact}
            formatLabel={shortDate}
            markers={[
              { value: settings.startingCash, label: `Start ${moneyCompact(settings.startingCash)}` },
              { value: GOAL, label: "$1M goal" },
            ]}
            revealKey={`${settings.period}-${settings.startingCash}`}
            height={280}
          />
        </Card>

        <motion.div {...appear(2)} className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          <StatTile label="Win rate" value={`${Math.round(snapshot.winRate * 100)}%`} note={`${snapshot.wins} wins · ${snapshot.losses} losses`} />
          <StatTile label="Realized P/L" value={signedMoneyWhole(snapshot.realizedPnl)} tone={snapshot.realizedPnl} />
          <StatTile label="Open P/L" value={signedMoneyWhole(snapshot.unrealizedPnl)} tone={snapshot.unrealizedPnl} />
          <StatTile
            label="Best trade"
            value={snapshot.bestTrade ? percent(snapshot.bestTrade.returnPct, 0) : "–"}
            tone={snapshot.bestTrade?.returnPct}
            note={snapshot.bestTrade ? snapshot.bestTrade.trade.symbol : undefined}
          />
          <StatTile label="Max drawdown" value={`-${(snapshot.maxDrawdown * 100).toFixed(1)}%`} note="worst dip from a high" />
          <StatTile label="Trades copied" value={copied.toLocaleString()} note={snapshot.skipped ? `${snapshot.skipped} skipped (no cash)` : "none skipped"} />
        </motion.div>

        <Card className="min-w-0 p-4" index={3}>
          <CardHeader title={`Open positions (${snapshot.positions.length})`} className="mb-2" />
          <OpenPositions positions={snapshot.positions} />
        </Card>
        <Card className="min-w-0 p-4" index={4}>
          <CardHeader title="Recently closed" className="mb-2" />
          <ClosedPositions closed={snapshot.closed} />
        </Card>
      </div>
    </>
  );
}
