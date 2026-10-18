import { isOpen, tradeReturn } from "../trades";
import type { Trade } from "../types";
import { replayPortfolio, type Replay } from "./portfolio";

/**
 * Scorecards for traders. To compare traders fairly we give each one the same
 * imaginary $100,000 account and put 10% of it into every trade they call.
 */

export const SCORECARD_CASH = 100_000;
export const SCORECARD_POSITION = 0.1;

export interface TraderStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  winRate: number;
  /** Average return of winning / losing trades, e.g. 0.18 and -0.09. */
  avgWin: number;
  avgLoss: number;
  bestReturn: number;
  /** The trader's $100k scorecard account. */
  replay: Replay;
}

export function traderStats(allTrades: Trade[], traderId: string, today: number): TraderStats {
  const trades = allTrades.filter((t) => t.traderId === traderId);
  const closedReturns = trades.filter((t) => !isOpen(t)).map((t) => tradeReturn(t, t.exitPrice ?? t.entryPrice));
  const winners = closedReturns.filter((r) => r > 0);
  const losers = closedReturns.filter((r) => r <= 0);

  return {
    totalTrades: trades.length,
    openTrades: trades.length - closedReturns.length,
    closedTrades: closedReturns.length,
    wins: winners.length,
    winRate: closedReturns.length ? winners.length / closedReturns.length : 0,
    avgWin: average(winners),
    avgLoss: average(losers),
    bestReturn: closedReturns.length ? Math.max(...closedReturns) : 0,
    replay: replayPortfolio(
      trades,
      { startingCash: SCORECARD_CASH, positionPct: SCORECARD_POSITION, traderIds: [traderId], startDay: 0 },
      today,
    ),
  };
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}
