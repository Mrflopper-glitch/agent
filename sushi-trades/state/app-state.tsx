"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_TRADERS } from "@/lib/demo/traders";
import { applyClock, generateDemoData, lastEventAt, type DemoData } from "@/lib/demo/generate";
import { closeOn, nextTick } from "@/lib/market/prices";
import { TICKERS } from "@/lib/market/tickers";
import { dayIndex } from "@/lib/market/time";
import type { DiscordData, Message, Trade, Trader } from "@/lib/types";

/**
 * The live heart of the app. It keeps three things up to date:
 *
 *   Clock  – the current time (moves every 10s)
 *   Prices – live simulated prices (tick every 1.5s)
 *   Data   – traders, trades and messages: demo history + whatever Discord sent
 *
 * They are separate contexts so a price tick only re-renders the parts of
 * the page that show prices.
 */

/** Set NEXT_PUBLIC_DEMO_DATA=false once your real Discord traders are flowing in. */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_DATA !== "false";

const CLOCK_MS = 10_000;
const TICK_MS = 1_500;
const DISCORD_POLL_MS = 5_000;

const NO_DEMO: DemoData = { trades: [], messages: [] };

// ── Contexts ─────────────────────────────────────────────────────────────────

interface Clock {
  now: number;
  /** Today's simulated day number (see lib/market/time.ts). */
  today: number;
}

interface Prices {
  /** The live price of any symbol. */
  priceOf: (symbol: string) => number;
}

interface Data {
  traders: Trader[];
  tradersById: Map<string, Trader>;
  trades: Trade[];
  /** Newest first. */
  messages: Message[];
  discord: DiscordData;
  /** Fetch the latest Discord data right now instead of waiting for the next poll. */
  refreshDiscord: () => Promise<void>;
}

const ClockContext = createContext<Clock | null>(null);
const PricesContext = createContext<Prices | null>(null);
const DataContext = createContext<Data | null>(null);

export function useClock(): Clock {
  return required(use(ClockContext));
}

export function usePrices(): Prices {
  return required(use(PricesContext));
}

export function useData(): Data {
  return required(use(DataContext));
}

function required<T>(value: T | null): T {
  if (!value) throw new Error("This component must be rendered inside <AppState>.");
  return value;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AppState({
  serverNow,
  initialDiscord,
  children,
}: {
  /** The server's clock, so the first render matches on server and browser. */
  serverNow: number;
  initialDiscord: DiscordData;
  children: ReactNode;
}) {
  // Clock
  const [now, setNow] = useState(serverNow);
  const today = dayIndex(now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);

  // Discord data: start with what the server sent, then poll for changes.
  const [discord, setDiscord] = useState(initialDiscord);
  const refreshDiscord = useCallback(async () => {
    const response = await fetch("/api/discord", { cache: "no-store" });
    if (response.ok) setDiscord((await response.json()) as DiscordData);
  }, []);
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/discord?since=${discord.version}`, { cache: "no-store" });
        if (response.status === 200) setDiscord((await response.json()) as DiscordData); // 204 = nothing new
      } catch {
        // Offline for a moment; try again next round.
      }
    }, DISCORD_POLL_MS);
    return () => clearInterval(timer);
  }, [discord.version]);

  // Demo history for today, revealed as the clock passes each event.
  const demoAll = useMemo(() => (DEMO_ENABLED ? generateDemoData(today) : NO_DEMO), [today]);
  const demoClock = lastEventAt(demoAll, now);
  const demo = useMemo(() => applyClock(demoAll, demoClock), [demoAll, demoClock]);

  const data = useMemo<Data>(() => {
    const traders = new Map<string, Trader>();
    if (DEMO_ENABLED) for (const trader of DEMO_TRADERS) traders.set(trader.id, trader);
    for (const trader of discord.traders) if (!traders.has(trader.id)) traders.set(trader.id, trader);

    return {
      traders: [...traders.values()],
      tradersById: traders,
      trades: [...demo.trades, ...discord.trades],
      messages: [...demo.messages, ...discord.messages].sort((a, b) => b.postedAt - a.postedAt),
      discord,
      refreshDiscord,
    };
  }, [demo, discord, refreshDiscord]);

  // Live prices for every known symbol plus any symbol traded on Discord.
  const symbols = useMemo(() => {
    const all = new Set(TICKERS.map((t) => t.symbol));
    for (const trade of discord.trades) all.add(trade.symbol);
    return [...all];
  }, [discord.trades]);

  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(symbols.map((symbol) => [symbol, closeOn(symbol, today)])),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      setPrices((previous) => {
        const next: Record<string, number> = {};
        for (const symbol of symbols) {
          const close = closeOn(symbol, today);
          next[symbol] = nextTick(symbol, previous[symbol] ?? close, close);
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [symbols, today]);

  const priceOf = useCallback((symbol: string) => prices[symbol] ?? closeOn(symbol, today), [prices, today]);

  const clock = useMemo(() => ({ now, today }), [now, today]);
  const priceValue = useMemo(() => ({ priceOf }), [priceOf]);

  return (
    <ClockContext value={clock}>
      <DataContext value={data}>
        <PricesContext value={priceValue}>{children}</PricesContext>
      </DataContext>
    </ClockContext>
  );
}
