import type { AssetClass, Trader } from "../types";

/**
 * The demo traders. They make the app feel alive before your Discord is
 * connected. Each one has a profile (shown in the UI) and a strategy (used by
 * ./generate.ts to invent a believable trading history).
 *
 * When real traders post in Discord they get their own profiles automatically,
 * and you can switch these off with NEXT_PUBLIC_DEMO_DATA=false.
 */

export interface DemoStrategy {
  /** Chance that any given trade is a winner (0.6 = 60%). */
  winRate: number;
  /** How many new trades they open in an average week. */
  tradesPerWeek: number;
  /** Shortest and longest number of days they hold a trade. */
  holdDays: [number, number];
  /** Which instruments they trade. */
  markets: AssetClass[];
  /** Their favorite symbols. */
  symbols: string[];
}

export interface DemoTrader extends Trader {
  strategy: DemoStrategy;
}

function demoTrader(
  handle: string,
  profile: Omit<Trader, "id" | "handle" | "source" | "discordUsername">,
  strategy: DemoStrategy,
): DemoTrader {
  const id = handle.toLowerCase();
  return { id, handle, discordUsername: id, source: "demo", ...profile, strategy };
}

export const DEMO_TRADERS: DemoTrader[] = [
  demoTrader(
    "NoahQuant",
    {
      name: "Noah Bennett",
      bio: "Systematic options trader. Quant models, tight risk, no ego.",
      color: "#0f766e",
      tags: ["Options", "Quant"],
      followers: 48_210,
    },
    { winRate: 0.64, tradesPerWeek: 3, holdDays: [2, 8], markets: ["option", "stock"], symbols: ["NVDA", "AMD", "META", "SPY", "QQQ", "TSLA"] },
  ),
  demoTrader(
    "LilyTrades",
    {
      name: "Lily Chen",
      bio: "Swing trader. Buying leaders on pullbacks. Patience over prediction.",
      color: "#be185d",
      tags: ["Swing", "Stocks"],
      followers: 36_904,
    },
    { winRate: 0.62, tradesPerWeek: 3, holdDays: [3, 12], markets: ["stock"], symbols: ["AAPL", "AMZN", "MSFT", "GOOGL", "META", "NVDA"] },
  ),
  demoTrader(
    "ArjunAI",
    {
      name: "Arjun Mehta",
      bio: "AI-assisted setups. Machine signals, human risk management.",
      color: "#4338ca",
      tags: ["AI Picks", "Options"],
      followers: 29_377,
    },
    { winRate: 0.61, tradesPerWeek: 4, holdDays: [1, 6], markets: ["option", "stock"], symbols: ["PLTR", "NVDA", "AMD", "MU", "APP", "TSLA"] },
  ),
  demoTrader(
    "TraderMia",
    {
      name: "Mia Rodriguez",
      bio: "Momentum, key levels and volume. Day trader turned swing trader.",
      color: "#c2410c",
      tags: ["Momentum", "Options"],
      followers: 22_158,
    },
    { winRate: 0.58, tradesPerWeek: 5, holdDays: [1, 4], markets: ["option"], symbols: ["SPY", "QQQ", "TSLA", "NVDA", "AAPL"] },
  ),
  demoTrader(
    "SashaCharts",
    {
      name: "Sasha Ivanova",
      bio: "Pure price action. Crypto and high-beta tech charts.",
      color: "#7c3aed",
      tags: ["Charts", "Crypto"],
      followers: 18_640,
    },
    { winRate: 0.58, tradesPerWeek: 3, holdDays: [2, 10], markets: ["crypto", "stock"], symbols: ["BTC", "ETH", "SOL", "COIN", "NVDA"] },
  ),
  demoTrader(
    "AlexTrades",
    {
      name: "Alex Carter",
      bio: "Host of the Morning Market Breakdown, live every weekday at 9:00 ET.",
      color: "#0369a1",
      tags: ["Live", "Options"],
      followers: 41_285,
    },
    { winRate: 0.6, tradesPerWeek: 4, holdDays: [1, 5], markets: ["option", "stock"], symbols: ["NVDA", "TSLA", "AAPL", "SPY", "AMZN"] },
  ),
  demoTrader(
    "QuantKing",
    {
      name: "Marcus Webb",
      bio: "Volatility and options structure. Defined risk, always.",
      color: "#15803d",
      tags: ["Options", "Volatility"],
      followers: 15_902,
    },
    { winRate: 0.6, tradesPerWeek: 3, holdDays: [3, 10], markets: ["option"], symbols: ["NVDA", "META", "AMD", "GOOGL", "MSFT"] },
  ),
  demoTrader(
    "SpaceTrader",
    {
      name: "Jordan Hayes",
      bio: "Small caps and space stocks. Early, then patient.",
      color: "#1e293b",
      tags: ["Small Caps", "Swing"],
      followers: 9_731,
    },
    { winRate: 0.55, tradesPerWeek: 2, holdDays: [5, 20], markets: ["stock", "option"], symbols: ["RKLB", "SOFI", "PLTR", "MU"] },
  ),
  demoTrader(
    "ValueHunt",
    {
      name: "Priya Shah",
      bio: "Long-term value. Great businesses, bought on sale.",
      color: "#a16207",
      tags: ["Long Term", "Value"],
      followers: 12_416,
    },
    { winRate: 0.66, tradesPerWeek: 1, holdDays: [20, 60], markets: ["stock"], symbols: ["APP", "AMZN", "GOOGL", "MU", "MSFT", "SOFI"] },
  ),
];
