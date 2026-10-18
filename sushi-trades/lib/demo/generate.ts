import { closeOn } from "../market/prices";
import { hashString, pick, randomInt, seededRandom } from "../market/random";
import { CRYPTO_SYMBOLS } from "../market/tickers";
import { dayStart, isWeekend } from "../market/time";
import { formatCloseAlert, formatOpenAlert } from "../discord/alerts";
import { markPrice } from "../trades";
import type { Message, Trade } from "../types";
import { DEMO_TRADERS, type DemoTrader } from "./traders";

/**
 * Invents a believable trading history for the demo traders.
 *
 * Every decision is driven by a seed made from (trader, day), so the history
 * is identical on the server and in the browser, and yesterday's trades are
 * still the same tomorrow. A trader's skill is their win rate: when a trade
 * should win, they "pick" the direction the market actually moved.
 */

const BULLISH_TITLES = ["Bullish Continuation", "Breakout Setup", "Undervalued Play", "Trend Pullback", "Earnings Run-up", "Reclaim of Key Level"];
const BEARISH_TITLES = ["Breakdown Short", "Failed Breakout", "Lower High Rejection"];

const CHAT_LINES = [
  "Added more {S} here. Still early IMO.",
  "My watchlist for next week 👀",
  "Why I'm bullish on {S} long term 🧵",
  "Watching {S} into the close.",
  "{S} holding the 20-day like a champ.",
  "Choppy tape today. Cash is a position.",
  "Big week ahead: CPI Wednesday, earnings Thursday.",
  "{S} chart looks primed, just needs volume.",
  "Patience pays. Sitting on my hands until {S} confirms.",
  "Reminder: size down when you're unsure.",
  "{S} flow is getting interesting 👀",
  "Green day. Locked in gains, no FOMO.",
];

/** How many days of chat (non-trade) messages to generate. */
const CHAT_HISTORY_DAYS = 21;

export interface DemoData {
  trades: Trade[];
  messages: Message[];
}

/**
 * Builds every demo trade and message up to the end of `day`.
 * Includes events later today; use `applyClock` to hide the ones that haven't happened yet.
 */
export function generateDemoData(day: number): DemoData {
  const trades: Trade[] = [];
  const messages: Message[] = [];

  for (const trader of DEMO_TRADERS) {
    for (let d = 0; d <= day; d++) {
      const trade = maybeOpenTrade(trader, d);
      if (trade) {
        trades.push(trade);
        if (d >= day - CHAT_HISTORY_DAYS * 3) messages.push(...alertMessages(trade));
      }
      if (d > day - CHAT_HISTORY_DAYS) {
        const chat = maybeChat(trader, d);
        if (chat) messages.push(chat);
      }
    }
  }
  return { trades, messages };
}

/** Rolls the dice for whether `trader` opens a trade on `day`, and builds it. */
function maybeOpenTrade(trader: DemoTrader, day: number): Trade | null {
  const { strategy } = trader;
  const random = seededRandom(hashString(trader.id) + day * 31337);
  if (isWeekend(day) || random() > strategy.tradesPerWeek / 5) return null;

  const market = pick(random, strategy.markets);
  const symbols = strategy.symbols.filter((s) => CRYPTO_SYMBOLS.has(s) === (market === "crypto"));
  if (symbols.length === 0) return null;
  const symbol = pick(random, symbols);

  const shouldWin = random() < strategy.winRate;
  const entryUnderlying = closeOn(symbol, day);

  // Try a few holding periods and keep one that gives the outcome we want.
  // Traders mostly go long, so we only go bearish when no window works long.
  const windows = Array.from({ length: 4 }, () => {
    const closeDay = nextWeekday(day + randomInt(random, ...strategy.holdDays));
    return { closeDay, wentUp: closeOn(symbol, closeDay) >= entryUnderlying };
  });
  const longWindow = windows.find((w) => w.wentUp === shouldWin);
  const bullish = longWindow !== undefined;
  const { closeDay } = longWindow ?? windows[0];
  if (market === "crypto" && !bullish) return null; // our crypto traders only buy spot

  const openedAt = dayStart(day) + marketHour(random);
  const closedAt = dayStart(closeDay) + marketHour(random);
  const size = random() < 0.15 ? 0.5 : 1;

  const trade: Trade = {
    id: `demo-${trader.id}-${day}`,
    traderId: trader.id,
    symbol,
    assetClass: market,
    direction: bullish || market !== "stock" ? "long" : "short",
    entryPrice: round(entryUnderlying),
    underlyingAtEntry: entryUnderlying,
    openedAt,
    closedAt,
    size,
    title: `${symbol} ${pick(random, bullish ? BULLISH_TITLES : BEARISH_TITLES)}`,
    likes: randomInt(random, 4, 140),
    source: "demo",
  };

  if (market === "option") {
    trade.option = {
      type: bullish ? "call" : "put",
      strike: roundToStrike(entryUnderlying * (bullish ? 1.02 : 0.98)),
      expiry: isoDate(nextFriday(closeDay + 7)),
    };
    trade.entryPrice = round(entryUnderlying * (0.018 + random() * 0.02));
    if (random() < 0.08) trade.size = 0.25; // a "lotto"
  }

  if (random() < 0.6) {
    const winning = trade.option ? 1.6 + random() * 0.6 : 1.06 + random() * 0.1;
    const losing = trade.option ? 0.55 : 0.95;
    const up = trade.direction === "long";
    trade.target = round(trade.entryPrice * (up ? winning : 2 - winning));
    trade.stop = round(trade.entryPrice * (up ? losing : 2 - losing));
  }

  trade.exitPrice = round(markPrice(trade, closeOn(symbol, closeDay), closedAt));
  return trade;
}

/** The Discord alerts a trader would have posted for this trade. */
function alertMessages(trade: Trade): Message[] {
  const base = { traderId: trade.traderId, channel: "trade-alerts", replies: 0, source: "demo" as const, tradeId: trade.id };
  const open: Message = {
    ...base,
    id: `${trade.id}-open`,
    content: formatOpenAlert(trade),
    postedAt: trade.openedAt,
    likes: trade.likes,
    replies: trade.likes % 37,
  };
  if (trade.closedAt === undefined) return [open];
  const close: Message = {
    ...base,
    id: `${trade.id}-close`,
    content: formatCloseAlert(trade),
    postedAt: trade.closedAt,
    likes: Math.round(trade.likes * 0.7),
  };
  return [open, close];
}

function maybeChat(trader: DemoTrader, day: number): Message | null {
  const random = seededRandom(hashString(trader.id) ^ (day * 7477));
  if (random() > 0.35) return null;
  const line = pick(random, CHAT_LINES).replace("{S}", pick(random, trader.strategy.symbols));
  return {
    id: `demo-chat-${trader.id}-${day}`,
    traderId: trader.id,
    channel: "general",
    content: line,
    postedAt: dayStart(day) + (12 + random() * 10) * 3_600_000,
    likes: randomInt(random, 3, 130),
    replies: randomInt(random, 0, 40),
    source: "demo",
  };
}

/**
 * Hides everything that hasn't "happened" yet at time `now`: trades opened
 * later today disappear, and trades closing later today show as still open.
 */
export function applyClock(data: DemoData, now: number): DemoData {
  const trades: Trade[] = [];
  for (const trade of data.trades) {
    if (trade.openedAt > now) continue;
    if (trade.closedAt !== undefined && trade.closedAt > now) {
      trades.push({ ...trade, closedAt: undefined, exitPrice: undefined });
    } else {
      trades.push(trade);
    }
  }
  const messages = data.messages.filter((message) => message.postedAt <= now);
  return { trades, messages };
}

/**
 * The time of the most recent demo event (a trade opening or closing, or a
 * message) at or before `now`. It only changes when something new happens,
 * which makes it a cheap way to know when to refresh.
 */
export function lastEventAt(data: DemoData, now: number): number {
  let latest = 0;
  for (const trade of data.trades) {
    if (trade.openedAt <= now) latest = Math.max(latest, trade.openedAt);
    if (trade.closedAt !== undefined && trade.closedAt <= now) latest = Math.max(latest, trade.closedAt);
  }
  for (const message of data.messages) {
    if (message.postedAt <= now) latest = Math.max(latest, message.postedAt);
  }
  return latest;
}

// ── small helpers ────────────────────────────────────────────────────────────

/** A random time during US market hours (UTC), in ms after midnight. */
function marketHour(random: () => number): number {
  return (13.5 + random() * 6.4) * 3_600_000;
}

function nextWeekday(day: number): number {
  let d = day;
  while (isWeekend(d)) d++;
  return d;
}

function nextFriday(day: number): number {
  let d = day;
  while (new Date(dayStart(d)).getUTCDay() !== 5) d++;
  return d;
}

function isoDate(day: number): string {
  return new Date(dayStart(day)).toISOString().slice(0, 10);
}

function roundToStrike(price: number): number {
  const step = price < 10 ? 0.5 : price < 50 ? 1 : price < 200 ? 5 : 10;
  return Math.round(price / step) * step;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
