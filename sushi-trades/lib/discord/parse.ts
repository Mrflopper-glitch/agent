import { CRYPTO_SYMBOLS, isKnownTicker } from "../market/tickers";
import type { AssetClass, Direction, OptionContract } from "../types";

/**
 * Reads a Discord message and works out whether it is a trade alert.
 *
 * It understands the common styles trading servers use, for example:
 *   BTO NVDA 140C 11/15 @ 2.50 PT 4 SL 1.40     → open an option
 *   $AAPL 190 calls 11/8 @ 1.85 (half size)     → open an option, half size
 *   Long BTC 67,425                              → open crypto
 *   Short TSLA at 252.16                         → open a short
 *   STC NVDA 140C @ 3.80                         → close an option
 *   Sold half AMZN @ 182                         → close half (a trim)
 *   Trim NVDA @ 3.20                             → close half
 * Anything else ("Added more NVDA here. Still early IMO.") is just chat.
 */

export type AlertAction = "open" | "close" | "trim";

export interface ParsedAlert {
  action: AlertAction;
  symbol: string;
  assetClass: AssetClass;
  /** Known for opens. For closes we match whichever open trade it refers to. */
  direction?: Direction;
  option?: OptionContract;
  price?: number;
  target?: number;
  stop?: number;
  /** 1 = normal size, 0.5 = half, 0.25 = lotto. */
  size: number;
  /** For trims: how much of the position was sold (0.5 = half). */
  fraction?: number;
}

export type ParseResult = { ok: true; alert: ParsedAlert } | { ok: false; reason: string };

// The words traders use for each kind of action.
const ACTIONS: Record<string, { action: AlertAction; direction?: Direction; size?: number }> = {};
for (const word of ["BTO", "BUY", "BUYING", "BOUGHT", "BOT", "LONG", "ENTRY", "ENTER", "ENTERED", "ENTERING", "OPEN", "OPENED", "OPENING", "ADD", "ADDED", "ADDING"])
  ACTIONS[word] = { action: "open", direction: "long" };
for (const word of ["STO", "SHORT", "SHORTED", "SHORTING"]) ACTIONS[word] = { action: "open", direction: "short" };
for (const word of ["STC", "SELL", "SELLING", "SOLD", "CLOSE", "CLOSED", "CLOSING", "EXIT", "EXITED", "EXITING", "COVER", "COVERED", "COVERING", "STOPPED"])
  ACTIONS[word] = { action: "close" };
for (const word of ["TRIM", "TRIMMED", "TRIMMING"]) ACTIONS[word] = { action: "trim" };
ACTIONS.LOTTO = { action: "open", direction: "long", size: 0.25 };

// Upper-case words that look like tickers but aren't.
const NOT_TICKERS = new Set([
  ...Object.keys(ACTIONS),
  "PT", "TP", "SL", "TGT", "TARGET", "STOP", "LOSS", "AVG", "DTE", "CALL", "CALLS", "PUT", "PUTS",
  "IMO", "FYI", "LOL", "NFA", "ATH", "EOD", "HOD", "LOD", "USD", "ETF", "CPI", "FOMC", "OTM", "ITM", "ATM",
  "HALF", "SIZE", "THE", "AND", "FOR", "OUT", "ALL", "NOW", "HERE", "AT", "ON", "IN", "TO", "IT", "IS", "MY", "WE", "UP",
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "SEPT", "OCT", "NOV", "DEC",
]);

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function parseAlert(text: string, postedAt: number = Date.now()): ParseResult {
  // 1. Clean up Discord formatting, emoji and thousands separators.
  let clean = text
    .replace(/[*_`~|>]/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  // 2. Size hints ("half size", "lotto"). Removed afterwards so "1/2 size" isn't read as a date.
  let size = 1;
  if (/\b(half|small|starter|light|1\/2)[\s-]*(size|position|pos)\b|\bstarter\b/i.test(clean)) size = 0.5;
  if (/\blotto\b|\b(tiny|quarter|1\/4)[\s-]*(size|position|pos)\b/i.test(clean)) size = 0.25;
  clean = clean.replace(/\b(half|small|starter|light|tiny|quarter|1\/2|1\/4)[\s-]*(size|position|pos)\b/gi, " ");

  const tokens = clean.split(" ").filter(Boolean);
  const words = tokens.map((token) => token.toUpperCase().replace(/[^A-Z0-9$./%]/g, ""));

  // 3. The action word ("BTO", "Sold", "Long"...).
  let actionIndex = -1;
  let action = null as (typeof ACTIONS)[string] | null;
  for (let i = 0; i < words.length; i++) {
    // "BTC" is Bitcoin, unless it is followed by a ticker: then it means "buy to close".
    if (words[i] === "BTC" && i + 1 < words.length && looksLikeTicker(tokens[i + 1], words[i + 1])) {
      actionIndex = i;
      action = { action: "close" };
      break;
    }
    if (ACTIONS[words[i]]) {
      actionIndex = i;
      action = ACTIONS[words[i]];
      break;
    }
  }
  // 4. The ticker: "$NVDA" wins, otherwise the first ticker-looking word after the action.
  const dollar = clean.match(/\$([A-Za-z]{1,5})\b/);
  let symbol = dollar ? dollar[1].toUpperCase() : null;
  if (!symbol) {
    const order = [...words.keys()].filter((i) => i > actionIndex).concat([...words.keys()].filter((i) => i < actionIndex));
    const found = order.find((i) => looksLikeTicker(tokens[i], words[i]));
    symbol = found === undefined ? null : words[found].replace(/[^A-Z]/g, "");
  }
  if (!symbol) return { ok: false, reason: "Couldn't find a ticker. Try writing it like NVDA or $NVDA." };

  // 5. Option details: strike + C/P, and an expiry.
  let option: OptionContract | undefined;
  const strikeMatch = clean.match(/(?:^|\s)\$?(\d+(?:\.\d+)?)\s?(c|p|calls?|puts?)(?![a-z])/i);
  if (strikeMatch) {
    option = {
      strike: Number(strikeMatch[1]),
      type: strikeMatch[2].toLowerCase().startsWith("c") ? "call" : "put",
      expiry: findExpiry(clean, postedAt),
    };
  }

  // 6. Profit target and stop loss.
  const target = numberAfter(clean, /\b(?:PT|TP|TGT|TARGETS?)\s*[:=]?\s*\$?(\d*\.?\d+)/i);
  const stop = numberAfter(clean, /\b(?:SL|STOP(?:\s*LOSS)?)\s*[:=]?\s*\$?(\d*\.?\d+)/i);

  // 7. The price: after "@", "at", "for"... or else the first plain number after the ticker.
  let price = numberAfter(clean, /(?:@|\bat\b|\bfor\b|\bprice\b|\bavg\b|\bentry\b|\bfilled\b)\s*[:=]?\s*\$?(\d*\.?\d+)/i);
  if (price === undefined) {
    const tickerIndex = words.findIndex((word) => word.replace(/[^A-Z]/g, "") === symbol);
    for (let i = tickerIndex + 1; i < words.length && tickerIndex >= 0; i++) {
      const previous = words[i - 1];
      if (["PT", "TP", "TGT", "TARGET", "SL", "STOP", "LOSS"].includes(previous)) continue;
      if (/^\$?\d*\.?\d+$/.test(words[i]) && !(option && Number(words[i]) === option.strike)) {
        price = Number(words[i].replace("$", ""));
        break;
      }
    }
  }

  // No action word, but "$AAPL 190 calls 11/8 @ 1.85" is still clearly an entry.
  if (!action && option && price !== undefined) action = { action: "open", direction: "long" };
  if (!action) return { ok: false, reason: "No trade action found (like BTO, STC, buy, sell, long, short, trim)." };

  // 8. Is this a partial close? ("trim", "sold half", "took partials")
  let kind = action.action;
  let fraction: number | undefined;
  if (kind === "trim" || (kind === "close" && /\b(half|partials?|some)\b/i.test(clean))) {
    kind = "trim";
    const percent = clean.match(/\btrim\w*\s+(\d{1,3})\s*%/i);
    fraction = percent ? Math.min(1, Number(percent[1]) / 100) : /\b(1\/3|third)\b/i.test(clean) ? 1 / 3 : 0.5;
  }

  if (kind === "open" && price === undefined) {
    return { ok: false, reason: `Found ${symbol} but no entry price. Add one like "@ 2.50".` };
  }

  const assetClass: AssetClass = option ? "option" : CRYPTO_SYMBOLS.has(symbol) ? "crypto" : "stock";
  return {
    ok: true,
    alert: {
      action: kind,
      symbol,
      assetClass,
      direction: action.direction,
      option,
      price,
      target,
      stop,
      size: action.size ?? size,
      fraction,
    },
  };
}

/** A word is a ticker if it's a known symbol, or 2-5 capital letters that aren't common trading slang. */
function looksLikeTicker(original: string, upper: string): boolean {
  const letters = upper.replace(/^\$/, "");
  if (!/^[A-Z]{1,5}$/.test(letters) || NOT_TICKERS.has(letters)) return false;
  if (original.startsWith("$") || isKnownTicker(letters)) return true;
  const bare = original.replace(/[^A-Za-z]/g, "");
  return bare.length >= 2 && bare === bare.toUpperCase();
}

function numberAfter(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  return match ? Number(match[1]) : undefined;
}

/**
 * Finds an option expiry like "11/15", "11/15/26", "Nov 15" or "0DTE".
 * Without a year we assume the next time that date comes around.
 * Without any expiry we assume this week's Friday.
 */
function findExpiry(text: string, postedAt: number): string {
  const posted = new Date(postedAt);
  const today = Date.UTC(posted.getUTCFullYear(), posted.getUTCMonth(), posted.getUTCDate());

  if (/\b0\s?dte\b/i.test(text)) return isoDate(today);

  let month: number | undefined;
  let day: number | undefined;
  let year: number | undefined;

  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  const named = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\b/i);
  if (numeric) {
    month = Number(numeric[1]);
    day = Number(numeric[2]);
    if (numeric[3]) year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
  } else if (named) {
    month = MONTHS.indexOf(named[1].slice(0, 3).toUpperCase()) + 1;
    day = Number(named[2]);
  }

  if (month && day && month <= 12 && day <= 31) {
    let date = Date.UTC(year ?? posted.getUTCFullYear(), month - 1, day);
    if (!year && date < today - 86_400_000) date = Date.UTC(posted.getUTCFullYear() + 1, month - 1, day);
    return isoDate(date);
  }

  // No expiry given: this week's Friday.
  const daysToFriday = (5 - posted.getUTCDay() + 7) % 7;
  return isoDate(today + daysToFriday * 86_400_000);
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
