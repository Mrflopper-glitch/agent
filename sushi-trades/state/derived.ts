"use client";

import { useMemo } from "react";
import { closeOn, closesBetween, intradayPrices } from "@/lib/market/prices";
import { liveSnapshot, replayPortfolio, type Snapshot } from "@/lib/sim/portfolio";
import { traderStats, type TraderStats } from "@/lib/sim/traders";
import type { Trade, Trader } from "@/lib/types";
import { useClock, useData, usePrices } from "./app-state";
import { usePrefs, type SimPeriod } from "./prefs";

/**
 * Hooks that turn raw data into the numbers the screens show.
 * Heavy work (replaying history) is memoized; only the live part
 * re-runs on each price tick.
 */

export const PERIOD_DAYS: Record<SimPeriod, number | null> = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365, ALL: null };

/** Your 7-figure simulator portfolio, using the settings saved in prefs. */
export function useSimulation() {
  const { trades, traders } = useData();
  const { today, now } = useClock();
  const { priceOf } = usePrices();
  const { sim } = usePrefs();

  const traderIds = useMemo(() => sim.traderIds ?? traders.map((t) => t.id), [sim.traderIds, traders]);
  const lookback = PERIOD_DAYS[sim.period];
  const startDay = lookback === null ? 0 : today - lookback;

  const replay = useMemo(
    () =>
      replayPortfolio(trades, { startingCash: sim.startingCash, positionPct: sim.positionPct, traderIds, startDay }, today),
    [trades, sim.startingCash, sim.positionPct, traderIds, startDay, today],
  );
  const snapshot = useMemo(() => liveSnapshot(replay, priceOf, now), [replay, priceOf, now]);

  return { settings: sim, traderIds, snapshot };
}

export interface TraderRow {
  trader: Trader;
  stats: TraderStats;
  /** The trader's $100k scorecard account, live. */
  snapshot: Snapshot;
}

// Scorecards are shared between every component that asks, and rebuilt only
// when the list of trades changes.
const statsCache = new WeakMap<Trade[], Map<string, TraderStats>>();

function cachedStats(trades: Trade[], traderId: string, today: number): TraderStats {
  let byTrader = statsCache.get(trades);
  if (!byTrader) statsCache.set(trades, (byTrader = new Map()));
  const key = `${traderId}:${today}`;
  let stats = byTrader.get(key);
  if (!stats) byTrader.set(key, (stats = traderStats(trades, traderId, today)));
  return stats;
}

/** Every trader with their live scorecard. */
export function useTraderBoard(): TraderRow[] {
  const { trades, traders } = useData();
  const { today, now } = useClock();
  const { priceOf } = usePrices();

  return useMemo(
    () =>
      traders.map((trader) => {
        const stats = cachedStats(trades, trader.id, today);
        return { trader, stats, snapshot: liveSnapshot(stats.replay, priceOf, now) };
      }),
    [traders, trades, today, priceOf, now],
  );
}

/** One trader's scorecard, or null if no such trader. */
export function useTrader(traderId: string): TraderRow | null {
  const board = useTraderBoard();
  return board.find((row) => row.trader.id === traderId) ?? null;
}

// ── Market data ──────────────────────────────────────────────────────────────

export type Range = "1D" | "1W" | "1M" | "3M" | "1Y";
export const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y"];
const RANGE_DAYS: Record<Exclude<Range, "1D">, number> = { "1W": 7, "1M": 30, "3M": 91, "1Y": 365 };

/** Price points for a chart, with the last point kept live. */
export function useSeries(symbol: string, range: Range): number[] {
  const { today } = useClock();
  const { priceOf } = usePrices();
  const history = useMemo(
    () => (range === "1D" ? intradayPrices(symbol, today) : closesBetween(symbol, today - RANGE_DAYS[range], today)),
    [symbol, range, today],
  );
  const live = priceOf(symbol);
  return useMemo(() => [...history.slice(0, -1), live], [history, live]);
}

/** Live price and today's change for a symbol. */
export function useQuote(symbol: string) {
  const { today } = useClock();
  const { priceOf } = usePrices();
  const price = priceOf(symbol);
  const previousClose = closeOn(symbol, today - 1);
  return { price, change: price / previousClose - 1, previousClose };
}

/** How a series did from its first point to its last. */
export function seriesChange(values: number[]): number {
  return values.length > 1 ? values[values.length - 1] / values[0] - 1 : 0;
}
