import { describe, expect, it } from "vitest";
import { parseAlert } from "../lib/discord/parse";

// Every test pretends the message was posted on Friday Oct 16, 2026.
const POSTED = Date.UTC(2026, 9, 16, 15, 0);

function parse(text: string) {
  const result = parseAlert(text, POSTED);
  if (!result.ok) throw new Error(`expected a trade, got: ${result.reason}`);
  return result.alert;
}

describe("parseAlert: opening trades", () => {
  it("reads a standard options alert", () => {
    expect(parse("BTO NVDA 140C 11/15 @ 2.50 PT 4 SL 1.40")).toEqual({
      action: "open",
      symbol: "NVDA",
      assetClass: "option",
      direction: "long",
      option: { type: "call", strike: 140, expiry: "2026-11-15" },
      price: 2.5,
      target: 4,
      stop: 1.4,
      size: 1,
      fraction: undefined,
    });
  });

  it("reads puts, $tickers and prices without a space", () => {
    const alert = parse("BTO $SPY 580P 10/30 @1.20");
    expect(alert.symbol).toBe("SPY");
    expect(alert.option).toEqual({ type: "put", strike: 580, expiry: "2026-10-30" });
    expect(alert.price).toBe(1.2);
  });

  it("understands alerts with no action word", () => {
    const alert = parse("$AAPL 190 calls 11/8 @ 1.85 (half size)");
    expect(alert.action).toBe("open");
    expect(alert.option?.type).toBe("call");
    expect(alert.size).toBe(0.5);
  });

  it("handles emoji, bold text and lotto size", () => {
    const alert = parse("🚨 **BTO** TSLA 260c 10/23 @ .85 lotto 🚀");
    expect(alert.symbol).toBe("TSLA");
    expect(alert.price).toBe(0.85);
    expect(alert.size).toBe(0.25);
  });

  it("reads 0DTE as expiring today", () => {
    expect(parse("BTO SPY 590C 0DTE @ 0.35").option?.expiry).toBe("2026-10-16");
  });

  it("rolls a past date into next year", () => {
    expect(parse("BTO AAPL 200C 1/16 @ 3.10").option?.expiry).toBe("2027-01-16");
  });

  it("defaults the expiry to this Friday when none is given", () => {
    expect(parse("BTO QQQ 500C @ 1.10").option?.expiry).toBe("2026-10-16");
  });

  it("reads stock and crypto entries", () => {
    expect(parse("BUY NVDA @ 135.42 PT 150 SL 128")).toMatchObject({ assetClass: "stock", direction: "long", price: 135.42, target: 150, stop: 128 });
    expect(parse("Long BTC 67,425")).toMatchObject({ symbol: "BTC", assetClass: "crypto", price: 67425 });
    expect(parse("Short TSLA at 252.16")).toMatchObject({ direction: "short", price: 252.16 });
    expect(parse("Bought 100 MU at 110.14")).toMatchObject({ symbol: "MU", price: 110.14 });
  });

  it("treats STO as selling (shorting) an option", () => {
    expect(parse("STO SPY 560P 11/20 @ 2.00")).toMatchObject({ action: "open", direction: "short", assetClass: "option" });
  });
});

describe("parseAlert: closing trades", () => {
  it("reads closes, with or without a price", () => {
    expect(parse("STC NVDA 140C @ 3.80 (+52%)")).toMatchObject({ action: "close", symbol: "NVDA", price: 3.8 });
    expect(parse("Closed MU 118.50")).toMatchObject({ action: "close", price: 118.5 });
    expect(parse("Stopped out of NVDA")).toMatchObject({ action: "close", symbol: "NVDA", price: undefined });
    expect(parse("Cover TSLA @ 240")).toMatchObject({ action: "close", price: 240 });
  });

  it("knows BTC means 'buy to close' when a ticker follows", () => {
    expect(parse("BTC SPY 560P @ 1.00")).toMatchObject({ action: "close", symbol: "SPY" });
    expect(parse("BTC long @ 70000")).toMatchObject({ action: "open", symbol: "BTC" });
  });

  it("reads trims and partial sells", () => {
    expect(parse("Trim NVDA 140c @ 3.20")).toMatchObject({ action: "trim", fraction: 0.5 });
    expect(parse("Sold half AMZN @ 182")).toMatchObject({ action: "trim", fraction: 0.5, price: 182 });
    expect(parse("Trim 25% META @ 7.10")).toMatchObject({ action: "trim", fraction: 0.25 });
  });
});

describe("parseAlert: plain chat", () => {
  it.each([
    "Added more NVDA here. Still early IMO.",
    "My watchlist for next week 👀",
    "gm everyone",
    "Market open in 5, watching NVDA",
  ])("is not a trade: %s", (text) => {
    expect(parseAlert(text, POSTED).ok).toBe(false);
  });
});
