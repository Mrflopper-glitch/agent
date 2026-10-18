import { DAY_MS } from "./market/time";
import type { Trade } from "./types";

/**
 * Small helpers that answer questions about a single trade:
 * what is it worth now, how much is it up, and how do we describe it.
 */

/** Options move roughly this many times more (in %) than the stock under them. */
export const OPTION_LEVERAGE = 8;
/** Options lose about this much of their value each day they are held (time decay). */
export const OPTION_DECAY_PER_DAY = 0.006;

/** Shares per option contract. */
export const CONTRACT_MULTIPLIER = 100;

/**
 * What one unit of the trade (share, coin or contract) is worth, given the
 * underlying's current price.
 *
 * Stocks and crypto simply follow the underlying. Options use a simple model:
 * a leveraged version of the underlying's move, minus time decay. It is not a
 * real options pricer, but it behaves the way traders expect.
 */
export function markPrice(trade: Trade, underlyingNow: number, at: number): number {
  const move = underlyingNow / trade.underlyingAtEntry - 1;
  if (!trade.option) return trade.entryPrice * (1 + move);

  const daysHeld = Math.max(0, (at - trade.openedAt) / DAY_MS);
  const exposure = trade.option.type === "call" ? move : -move;
  const value = trade.entryPrice * (1 + OPTION_LEVERAGE * exposure - OPTION_DECAY_PER_DAY * daysHeld);
  return Math.max(0.01, value);
}

/** Percent return of a trade at a given price, e.g. 0.12 = +12%. */
export function tradeReturn(trade: Trade, price: number): number {
  const change = price / trade.entryPrice - 1;
  return trade.direction === "long" ? change : -change;
}

export function isOpen(trade: Trade): boolean {
  return trade.closedAt === undefined;
}

/** Closed trades, most recently closed first. */
export function byCloseDate(trades: Trade[]): Trade[] {
  return trades.filter((t) => !isOpen(t)).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
}

/** Does the trader expect the underlying to go up? */
export function isBullish(trade: Trade): boolean {
  if (trade.option) {
    const bullishContract = trade.option.type === "call";
    return trade.direction === "long" ? bullishContract : !bullishContract;
  }
  return trade.direction === "long";
}

/** "NVDA 140C 11/15", "TSLA", "BTC". */
export function describeInstrument(trade: Trade): string {
  if (!trade.option) return trade.symbol;
  const [, month, day] = trade.option.expiry.split("-");
  const type = trade.option.type === "call" ? "C" : "P";
  return `${trade.symbol} ${trade.option.strike}${type} ${Number(month)}/${Number(day)}`;
}

/** The trading-floor verb for how a trade was opened: BTO, STO, LONG, SHORT. */
export function openVerb(trade: Trade): string {
  if (trade.option) return trade.direction === "long" ? "BTO" : "STO";
  return trade.direction === "long" ? "LONG" : "SHORT";
}

/** ...and for how it was closed: STC, BTC, SOLD, COVER. */
export function closeVerb(trade: Trade): string {
  if (trade.option) return trade.direction === "long" ? "STC" : "BTC";
  return trade.direction === "long" ? "SOLD" : "COVER";
}
