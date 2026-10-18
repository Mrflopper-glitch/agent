import { describe, expect, it } from "vitest";
import { applyClock, generateDemoData } from "../lib/demo/generate";
import { parseAlert } from "../lib/discord/parse";
import { closeOn, intradayPrices } from "../lib/market/prices";
import { dayIndex } from "../lib/market/time";

const NOW = Date.UTC(2026, 9, 16, 16, 0);
const TODAY = dayIndex(NOW);

describe("simulated market", () => {
  it("gives the same price for the same day no matter what was computed first", () => {
    const later = closeOn("AAPL", TODAY);
    expect(closeOn("AAPL", TODAY - 200)).toBeGreaterThan(0);
    expect(closeOn("AAPL", TODAY)).toBe(later);
  });

  it("intraday path starts at yesterday's close and ends at today's", () => {
    const path = intradayPrices("NVDA", TODAY);
    expect(path[0]).toBeCloseTo(closeOn("NVDA", TODAY - 1), 6);
    expect(path[path.length - 1]).toBeCloseTo(closeOn("NVDA", TODAY), 6);
  });
});

describe("demo data", () => {
  const data = applyClock(generateDemoData(TODAY), NOW);

  it("is identical every time it is generated", () => {
    const again = applyClock(generateDemoData(TODAY), NOW);
    expect(again.trades.length).toBe(data.trades.length);
    expect(again.trades[100]).toEqual(data.trades[100]);
  });

  it("never shows events from the future", () => {
    for (const trade of data.trades) {
      expect(trade.openedAt).toBeLessThanOrEqual(NOW);
      if (trade.closedAt !== undefined) expect(trade.closedAt).toBeLessThanOrEqual(NOW);
    }
    for (const message of data.messages) expect(message.postedAt).toBeLessThanOrEqual(NOW);
  });

  it("has some trades still open", () => {
    expect(data.trades.some((t) => t.closedAt === undefined)).toBe(true);
  });

  it("writes alerts our own Discord parser can read back", () => {
    const tradesById = new Map(data.trades.map((t) => [t.id, t]));
    const alerts = data.messages.filter((m) => m.tradeId);
    expect(alerts.length).toBeGreaterThan(50);

    for (const message of alerts) {
      const trade = tradesById.get(message.tradeId!)!;
      const result = parseAlert(message.content, message.postedAt);
      expect(result.ok, message.content).toBe(true);
      if (!result.ok) continue;
      expect(result.alert.symbol).toBe(trade.symbol);
      expect(result.alert.option?.strike).toBe(trade.option?.strike);
      expect(result.alert.option?.type).toBe(trade.option?.type);
      if (message.id.endsWith("-open")) {
        expect(result.alert.action).toBe("open");
        expect(result.alert.price).toBe(trade.entryPrice);
        expect(result.alert.direction).toBe(trade.direction);
        expect(result.alert.option?.expiry).toBe(trade.option?.expiry);
      } else {
        expect(result.alert.action).toBe("close");
        expect(result.alert.price).toBe(trade.exitPrice);
      }
    }
  });
});
