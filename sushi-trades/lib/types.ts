/**
 * The shared vocabulary of the app. Every other file speaks in these types.
 *
 *   Trader  → a person in your Discord who posts trade calls
 *   Trade   → one position a trader opened (and maybe closed)
 *   Message → one Discord message (a trade call or just chat)
 */

/** Where a record came from: generated demo history, or a real Discord message. */
export type Source = "demo" | "discord";

export type AssetClass = "stock" | "option" | "crypto";

/** Which way the position profits: "long" gains when its price rises, "short" when it falls. */
export type Direction = "long" | "short";

export interface OptionContract {
  type: "call" | "put";
  strike: number;
  /** Expiration date as YYYY-MM-DD. */
  expiry: string;
}

export interface Trader {
  /** Stable lowercase id, e.g. "noahquant". Used in URLs: /traders/noahquant */
  id: string;
  /** Display handle without the @, e.g. "NoahQuant". */
  handle: string;
  name: string;
  bio: string;
  /** Avatar background color (hex). */
  color: string;
  /** Short labels shown on cards, e.g. ["Options", "Swing"]. */
  tags: string[];
  followers: number;
  /** The Discord username we match incoming messages against. */
  discordUsername?: string;
  source: Source;
}

export interface Trade {
  id: string;
  traderId: string;
  /** The underlying ticker, e.g. "NVDA" (for options too). */
  symbol: string;
  assetClass: AssetClass;
  /** For options this is the side of the contract itself (bought = "long"). */
  direction: Direction;
  option?: OptionContract;
  /** Price paid per share / per coin / per option contract (premium). */
  entryPrice: number;
  /** The underlying's price when the trade opened. Used to mark the trade to market. */
  underlyingAtEntry: number;
  exitPrice?: number;
  openedAt: number;
  closedAt?: number;
  /** 1 = the trader's normal size, 0.5 = half size, 0.25 = "lotto" size. */
  size: number;
  target?: number;
  stop?: number;
  /** Optional idea headline, e.g. "NVDA Breakout Setup". */
  title?: string;
  likes: number;
  source: Source;
  /** The original Discord message text that opened this trade. */
  rawMessage?: string;
}

export interface Message {
  id: string;
  traderId: string;
  channel: string;
  content: string;
  postedAt: number;
  likes: number;
  replies: number;
  /** Set when the message was parsed into a trade. */
  tradeId?: string;
  source: Source;
}

/** Everything that arrives from Discord, as stored by the server. */
export interface DiscordData {
  traders: Trader[];
  trades: Trade[];
  messages: Message[];
  /** When the bot last delivered a message (ms), or null if it never has. */
  lastMessageAt: number | null;
  /** Goes up by one on every change, so the browser can tell when to refresh. */
  version: number;
}
