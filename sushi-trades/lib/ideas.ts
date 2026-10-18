import { isOpen } from "./trades";
import type { Trade, Trader } from "./types";

/**
 * "Trade ideas" are simply open trades, grouped into tabs.
 * The ones with the most likes come first.
 */

export const IDEA_TABS = ["Trending", "Options", "Swing", "Long Term", "AI Picks"] as const;
export type IdeaTab = (typeof IDEA_TABS)[number];

export function pickIdeas(trades: Trade[], tradersById: Map<string, Trader>, tab: IdeaTab): Trade[] {
  const open = trades.filter(isOpen);
  const hasTag = (trade: Trade, tag: string) => tradersById.get(trade.traderId)?.tags.includes(tag) ?? false;

  const matches: Record<IdeaTab, (trade: Trade) => boolean> = {
    Trending: () => true,
    Options: (t) => t.option !== undefined,
    Swing: (t) => hasTag(t, "Swing") || hasTag(t, "Momentum"),
    "Long Term": (t) => hasTag(t, "Long Term") || hasTag(t, "Value"),
    "AI Picks": (t) => hasTag(t, "AI Picks") || hasTag(t, "Quant"),
  };

  return open.filter(matches[tab]).sort((a, b) => b.likes - a.likes);
}

/** How far the trader expects it to go: from entry to their profit target. */
export function expectedMove(trade: Trade): number | null {
  if (trade.target === undefined) return null;
  const move = trade.target / trade.entryPrice - 1;
  return trade.direction === "long" ? move : -move;
}
