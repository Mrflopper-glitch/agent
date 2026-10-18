import { describe, expect, it } from "vitest";
import { closeOn } from "../lib/market/prices";
import { dayIndex, dayStart } from "../lib/market/time";
import { liveSnapshot, maxDrawdown, periodReturn, projectGoal, replayPortfolio } from "../lib/sim/portfolio";
import { markPrice } from "../lib/trades";
import type { Trade } from "../lib/types";

const NOW = Date.UTC(2026, 9, 16, 21, 0);
const TODAY = dayIndex(NOW);

function stockTrade(overrides: Partial<Trade>): Trade {
  return {
    id: "t1",
    traderId: "alice",
    symbol: "TEST",
    assetClass: "stock",
    direction: "long",
    entryPrice: 100,
    underlyingAtEntry: 100,
    openedAt: dayStart(TODAY - 10) + 1000,
    size: 1,
    likes: 0,
    source: "discord",
    ...overrides,
  };
}

const settings = { startingCash: 100_000, positionPct: 0.1, traderIds: ["alice"], startDay: TODAY - 30 };

describe("replayPortfolio", () => {
  it("books a winning long trade", () => {
    const trade = stockTrade({ exitPrice: 110, closedAt: dayStart(TODAY - 5) + 1000 });
    const snapshot = liveSnapshot(replayPortfolio([trade], settings, TODAY), () => 1, NOW);

    // 10% of $100k buys 100 shares at $100; selling at $110 makes $1,000.
    expect(snapshot.closed).toHaveLength(1);
    expect(snapshot.closed[0].pnl).toBeCloseTo(1000);
    expect(snapshot.equity).toBeCloseTo(101_000);
    expect(snapshot.winRate).toBe(1);
  });

  it("books a short trade that the price moved against", () => {
    const trade = stockTrade({ direction: "short", exitPrice: 105, closedAt: dayStart(TODAY - 5) + 1000 });
    const snapshot = liveSnapshot(replayPortfolio([trade], settings, TODAY), () => 1, NOW);
    expect(snapshot.closed[0].pnl).toBeCloseTo(-500);
    expect(snapshot.equity).toBeCloseTo(99_500);
  });

  it("marks open positions to live prices", () => {
    const trade = stockTrade({ underlyingAtEntry: 50 }); // the underlying was $50 when it opened
    const replay = replayPortfolio([trade], settings, TODAY);
    const snapshot = liveSnapshot(replay, () => 55, NOW); // ...and is $55 now: +10%

    expect(snapshot.positions).toHaveLength(1);
    expect(snapshot.positions[0].mark).toBeCloseTo(110);
    expect(snapshot.unrealizedPnl).toBeCloseTo(1000);
    expect(snapshot.points[snapshot.points.length - 1].equity).toBeCloseTo(snapshot.equity);
  });

  it("only copies the chosen traders, from the chosen start day", () => {
    const other = stockTrade({ id: "t2", traderId: "bob", exitPrice: 200, closedAt: dayStart(TODAY - 5) });
    const tooEarly = stockTrade({ id: "t3", openedAt: dayStart(TODAY - 60), exitPrice: 200, closedAt: dayStart(TODAY - 50) });
    const snapshot = liveSnapshot(replayPortfolio([other, tooEarly], settings, TODAY), () => 1, NOW);
    expect(snapshot.closed).toHaveLength(0);
    expect(snapshot.equity).toBe(100_000);
  });

  it("skips trades it can't afford instead of borrowing", () => {
    const trades = Array.from({ length: 12 }, (_, i) => stockTrade({ id: `t${i}` }));
    const replay = replayPortfolio(trades, { ...settings, positionPct: 0.2 }, TODAY);
    expect(replay.cash).toBeGreaterThanOrEqual(0);
    expect(replay.skipped).toBeGreaterThan(0);
  });

  it("buys whole option contracts and values them with the option model", () => {
    const underlying = closeOn("NVDA", TODAY - 10);
    const trade = stockTrade({
      symbol: "NVDA",
      assetClass: "option",
      option: { type: "call", strike: 140, expiry: "2026-11-20" },
      entryPrice: 2.5,
      underlyingAtEntry: underlying,
    });
    const replay = replayPortfolio([trade], settings, TODAY);
    // $10,000 buys 40 contracts at $250 each.
    expect(replay.open[0].quantity).toBe(40);
    const snapshot = liveSnapshot(replay, () => underlying * 1.05, NOW);
    expect(snapshot.positions[0].mark).toBeCloseTo(markPrice(trade, underlying * 1.05, NOW));
    expect(snapshot.positions[0].pnl).toBeGreaterThan(0);
  });
});

describe("portfolio math", () => {
  const points = [100, 120, 90, 150].map((equity, day) => ({ day, equity }));

  it("measures the worst drawdown", () => {
    expect(maxDrawdown(points)).toBeCloseTo(0.25); // 120 → 90
  });

  it("measures returns over a window", () => {
    expect(periodReturn(points, 1)).toBeCloseTo(150 / 90 - 1);
    expect(periodReturn(points, 99)).toBeCloseTo(0.5);
  });

  it("projects when the goal will be reached", () => {
    const doubling = [{ day: 0, equity: 100_000 }, { day: 365, equity: 200_000 }];
    const projection = projectGoal(doubling, 800_000);
    expect(projection.yearlyGrowth).toBeCloseTo(1);
    expect(projection.daysToGoal).toBeCloseTo(730); // two more doublings
    expect(projectGoal([{ day: 0, equity: 100 }, { day: 10, equity: 90 }], 1000).daysToGoal).toBeNull();
  });
});
