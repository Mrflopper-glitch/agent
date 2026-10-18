import { hashString } from "./random";

/**
 * Every symbol the simulated market knows about.
 *
 * `price` is roughly where the symbol trades today. `volatility` is the typical
 * daily move (0.025 = 2.5%). Symbols that show up from Discord but are not in
 * this list still work: they get a generated entry (see getTicker).
 */

export type TickerKind = "stock" | "crypto" | "index";

export interface Ticker {
  symbol: string;
  name: string;
  kind: TickerKind;
  price: number;
  volatility: number;
  /** Brand color for the little ticker badge. */
  color: string;
}

export const TICKERS: Ticker[] = [
  { symbol: "SPX", name: "S&P 500", kind: "index", price: 5780.29, volatility: 0.009, color: "#1f2937" },
  { symbol: "IXIC", name: "NASDAQ", kind: "index", price: 18315.42, volatility: 0.012, color: "#1f2937" },
  { symbol: "DJI", name: "DOW", kind: "index", price: 42212.36, volatility: 0.008, color: "#1f2937" },

  { symbol: "BTC", name: "Bitcoin", kind: "crypto", price: 67425.1, volatility: 0.028, color: "#f7931a" },
  { symbol: "ETH", name: "Ethereum", kind: "crypto", price: 2618.45, volatility: 0.034, color: "#627eea" },
  { symbol: "SOL", name: "Solana", kind: "crypto", price: 152.3, volatility: 0.042, color: "#9945ff" },
  { symbol: "XRP", name: "XRP", kind: "crypto", price: 0.5432, volatility: 0.04, color: "#23292f" },
  { symbol: "DOGE", name: "Dogecoin", kind: "crypto", price: 0.1285, volatility: 0.05, color: "#c2a633" },

  { symbol: "NVDA", name: "NVIDIA", kind: "stock", price: 135.42, volatility: 0.027, color: "#76b900" },
  { symbol: "AAPL", name: "Apple", kind: "stock", price: 184.2, volatility: 0.015, color: "#111111" },
  { symbol: "TSLA", name: "Tesla", kind: "stock", price: 252.16, volatility: 0.032, color: "#e31937" },
  { symbol: "AMZN", name: "Amazon", kind: "stock", price: 178.32, volatility: 0.019, color: "#ff9900" },
  { symbol: "MU", name: "Micron", kind: "stock", price: 110.14, volatility: 0.028, color: "#0a4ea2" },
  { symbol: "RKLB", name: "Rocket Lab", kind: "stock", price: 5.28, volatility: 0.045, color: "#111111" },
  { symbol: "APP", name: "AppLovin", kind: "stock", price: 78.4, volatility: 0.036, color: "#1463ff" },
  { symbol: "MSFT", name: "Microsoft", kind: "stock", price: 415.5, volatility: 0.014, color: "#00a4ef" },
  { symbol: "META", name: "Meta", kind: "stock", price: 512.3, volatility: 0.021, color: "#0866ff" },
  { symbol: "AMD", name: "AMD", kind: "stock", price: 158.75, volatility: 0.029, color: "#111111" },
  { symbol: "GOOGL", name: "Alphabet", kind: "stock", price: 165.4, volatility: 0.017, color: "#4285f4" },
  { symbol: "PLTR", name: "Palantir", kind: "stock", price: 38.6, volatility: 0.035, color: "#111111" },
  { symbol: "COIN", name: "Coinbase", kind: "stock", price: 198.4, volatility: 0.038, color: "#0052ff" },
  { symbol: "SOFI", name: "SoFi", kind: "stock", price: 9.85, volatility: 0.03, color: "#00a2c7" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", kind: "stock", price: 578.1, volatility: 0.009, color: "#8a1538" },
  { symbol: "QQQ", name: "Invesco QQQ", kind: "stock", price: 492.3, volatility: 0.012, color: "#2c6ab1" },
];

const BY_SYMBOL = new Map(TICKERS.map((ticker) => [ticker.symbol, ticker]));

export const CRYPTO_SYMBOLS = new Set(["BTC", "ETH", "SOL", "DOGE", "XRP", "ADA", "AVAX", "LINK"]);

/** Looks up a symbol, inventing a plausible one if we have never seen it. */
export function getTicker(symbol: string): Ticker {
  const known = BY_SYMBOL.get(symbol);
  if (known) return known;

  const hash = hashString(symbol);
  return {
    symbol,
    name: symbol,
    kind: CRYPTO_SYMBOLS.has(symbol) ? "crypto" : "stock",
    price: 10 + (hash % 29000) / 100,
    volatility: 0.03,
    color: `hsl(${hash % 360} 55% 42%)`,
  };
}

export function isKnownTicker(symbol: string): boolean {
  return BY_SYMBOL.has(symbol);
}
