import { closeVerb, describeInstrument, openVerb, tradeReturn } from "../trades";
import type { Trade } from "../types";

/**
 * Writes trades out the way traders post them in Discord, e.g.
 *   "BTO NVDA 140C 11/15 @ 2.50 PT 4.00 SL 1.40"
 *   "STC NVDA 140C 11/15 @ 3.80 (+52%)"
 * The parser in ./parse.ts reads this exact format back.
 */

function price(value: number): string {
  return value.toFixed(2);
}

export function formatOpenAlert(trade: Trade): string {
  const parts = [openVerb(trade), describeInstrument(trade), `@ ${price(trade.entryPrice)}`];
  if (trade.target !== undefined) parts.push(`PT ${price(trade.target)}`);
  if (trade.stop !== undefined) parts.push(`SL ${price(trade.stop)}`);
  if (trade.size === 0.5) parts.push("(half size)");
  if (trade.size === 0.25) parts.push("(lotto)");
  return parts.join(" ");
}

export function formatCloseAlert(trade: Trade): string {
  const exit = trade.exitPrice ?? trade.entryPrice;
  const percent = tradeReturn(trade, exit) * 100;
  const sign = percent >= 0 ? "+" : "";
  return `${closeVerb(trade)} ${describeInstrument(trade)} @ ${price(exit)} (${sign}${percent.toFixed(1)}%)`;
}
