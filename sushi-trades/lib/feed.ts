import type { Trade } from "./types";

/**
 * A trade produces up to two feed events: when it opens and when it closes.
 * The trade feed, notifications and pop-up toasts all show these events.
 */
export interface TradeEvent {
  /** Unique per event, e.g. "demo-noahquant-640:close". */
  key: string;
  kind: "open" | "close";
  trade: Trade;
  at: number;
}

/** All open/close events, newest first. */
export function tradeEvents(trades: Trade[]): TradeEvent[] {
  const events: TradeEvent[] = [];
  for (const trade of trades) {
    events.push({ key: `${trade.id}:open`, kind: "open", trade, at: trade.openedAt });
    if (trade.closedAt !== undefined) events.push({ key: `${trade.id}:close`, kind: "close", trade, at: trade.closedAt });
  }
  return events.sort((a, b) => b.at - a.at);
}
