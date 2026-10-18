import { DEMO_TRADERS } from "../demo/traders";
import { parseAlert, type AlertAction, type ParseResult } from "../discord/parse";
import { closeOn } from "../market/prices";
import { dayIndex } from "../market/time";
import { isBullish, isOpen, markPrice } from "../trades";
import type { DiscordData, Message, Trade, Trader } from "../types";

/**
 * What happens when a Discord message arrives:
 *
 *   1. Find (or create) the trader who posted it.
 *   2. Save the message, so it shows in Community.
 *   3. If it's a trade alert, open, close or trim the matching trade.
 *
 * This only changes the `data` object it's given; saving is up to the caller.
 */

/** The message as the Discord bot sends it to /api/discord/ingest. */
export interface IncomingMessage {
  /** Discord's message id. Sending the same id twice is harmless. */
  id: string;
  authorId?: string;
  authorUsername: string;
  authorDisplayName?: string;
  channelName?: string;
  content: string;
  /** When it was posted (ms or ISO string). Defaults to now. */
  timestamp?: number | string;
}

export interface IngestResult {
  duplicate: boolean;
  message: Message;
  parse: ParseResult;
  action?: AlertAction;
  trade?: Trade;
  /** A human-readable note when something didn't line up, e.g. nothing to close. */
  note?: string;
}

const PALETTE = ["#0f766e", "#be185d", "#4338ca", "#c2410c", "#7c3aed", "#0369a1", "#15803d", "#a16207", "#b91c1c", "#334155"];

export function ingestMessage(data: DiscordData, incoming: IncomingMessage): IngestResult {
  const postedAt = toTime(incoming.timestamp);
  const messageId = `discord-${incoming.id}`;
  const parse = parseAlert(incoming.content, postedAt);

  const existing = data.messages.find((m) => m.id === messageId);
  if (existing) return { duplicate: true, message: existing, parse };

  const trader = findOrCreateTrader(data, incoming);
  const message: Message = {
    id: messageId,
    traderId: trader.id,
    channel: incoming.channelName ?? "discord",
    content: incoming.content,
    postedAt,
    likes: 0,
    replies: 0,
    source: "discord",
  };
  data.messages.push(message);
  data.lastMessageAt = Date.now();

  if (!parse.ok) return { duplicate: false, message, parse };
  const alert = parse.alert;
  const day = dayIndex(postedAt);

  if (alert.action === "open") {
    const trade: Trade = {
      id: `discord-${incoming.id}`,
      traderId: trader.id,
      symbol: alert.symbol,
      assetClass: alert.assetClass,
      direction: alert.direction ?? "long",
      option: alert.option,
      entryPrice: alert.price!,
      underlyingAtEntry: closeOn(alert.symbol, day),
      openedAt: postedAt,
      size: alert.size,
      target: alert.target,
      stop: alert.stop,
      likes: 0,
      source: "discord",
      rawMessage: incoming.content,
    };
    trade.title = `${trade.symbol} ${tradeLabel(trade)}`;
    data.trades.push(trade);
    message.tradeId = trade.id;
    return { duplicate: false, message, parse, action: "open", trade };
  }

  // Closing or trimming: find this trader's most recent open trade in that symbol (and contract).
  const open = data.trades
    .filter(
      (t) =>
        t.traderId === trader.id &&
        t.symbol === alert.symbol &&
        isOpen(t) &&
        (!alert.option || (t.option?.strike === alert.option.strike && t.option?.type === alert.option.type)),
    )
    .sort((a, b) => b.openedAt - a.openedAt)[0];

  if (!open) {
    return { duplicate: false, message, parse, note: `No open ${alert.symbol} trade from @${trader.handle} to ${alert.action}.` };
  }

  const exitPrice = alert.price ?? round(markPrice(open, closeOn(open.symbol, day), postedAt));
  message.tradeId = open.id;

  if (alert.action === "close") {
    open.exitPrice = exitPrice;
    open.closedAt = postedAt;
    return { duplicate: false, message, parse, action: "close", trade: open };
  }

  // A trim closes part of the position: split off the sold part as its own closed trade.
  const fraction = alert.fraction ?? 0.5;
  const sold: Trade = { ...open, id: `${open.id}-trim-${incoming.id}`, size: open.size * fraction, exitPrice, closedAt: postedAt };
  open.size = open.size * (1 - fraction);
  data.trades.push(sold);
  return { duplicate: false, message, parse, action: "trim", trade: sold };
}

function findOrCreateTrader(data: DiscordData, incoming: IncomingMessage): Trader {
  const username = incoming.authorUsername.toLowerCase();
  const id = username.replace(/[^a-z0-9_.-]/g, "") || "trader";

  const known = data.traders.find((t) => t.id === id);
  if (known) return known;

  // Someone who is also a demo trader keeps their demo profile.
  const demo = DEMO_TRADERS.find((t) => t.discordUsername === username);
  const trader: Trader = demo
    ? { id: demo.id, handle: demo.handle, name: demo.name, bio: demo.bio, color: demo.color, tags: demo.tags, followers: demo.followers, discordUsername: username, source: "discord" }
    : {
        id,
        handle: (incoming.authorDisplayName || incoming.authorUsername).replace(/\s+/g, ""),
        name: incoming.authorDisplayName || incoming.authorUsername,
        bio: "Posts trade calls in the Sushi Discord.",
        color: PALETTE[data.traders.length % PALETTE.length],
        tags: ["Discord"],
        followers: 0,
        discordUsername: username,
        source: "discord",
      };
  data.traders.push(trader);
  return trader;
}

function tradeLabel(trade: Trade): string {
  if (trade.option) return trade.option.type === "call" ? "Calls" : "Puts";
  return isBullish(trade) ? "Long" : "Short";
}

function toTime(timestamp: number | string | undefined): number {
  const time = typeof timestamp === "string" ? Date.parse(timestamp) : timestamp;
  return time && Number.isFinite(time) ? time : Date.now();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
