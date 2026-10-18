"use client";

import { useSyncExternalStore } from "react";

/**
 * Your personal settings, saved in this browser (localStorage):
 * the simulator setup, your watchlist, who you follow, and which
 * notifications you've already seen.
 */

export type SimPeriod = "1M" | "3M" | "6M" | "1Y" | "ALL";

export interface SimPrefs {
  startingCash: number;
  /** Share of the account put into each copied trade (0.03 = 3%). */
  positionPct: number;
  /** Traders to copy. null means "everyone". */
  traderIds: string[] | null;
  /** How far back the simulation starts. */
  period: SimPeriod;
}

export interface Prefs {
  sim: SimPrefs;
  watchlist: string[];
  following: string[];
  /** Notifications older than this (ms) count as read. */
  seenUntil: number;
}

export const DEFAULT_PREFS: Prefs = {
  sim: { startingCash: 100_000, positionPct: 0.03, traderIds: null, period: "1Y" },
  watchlist: ["NVDA", "AAPL", "TSLA", "AMZN", "MU", "RKLB"],
  following: ["alextrades", "lilytrades", "arjunai"],
  seenUntil: 0,
};

const STORAGE_KEY = "sushi-prefs-v1";
const listeners = new Set<() => void>();
let current: Prefs | null = null;

function read(): Prefs {
  if (current) return current;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Prefs>;
    current = { ...DEFAULT_PREFS, ...saved, sim: { ...DEFAULT_PREFS.sim, ...saved.sim } };
  } catch {
    current = DEFAULT_PREFS;
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read your settings. Re-renders whenever they change. */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
}

/** Change your settings: updatePrefs(p => ({ ...p, following: [...] })) */
export function updatePrefs(change: (prefs: Prefs) => Prefs) {
  current = change(read());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private mode or storage full: settings still work until the tab closes.
  }
  listeners.forEach((listener) => listener());
}

export function setSim(change: Partial<SimPrefs>) {
  updatePrefs((prefs) => ({ ...prefs, sim: { ...prefs.sim, ...change } }));
}

export function toggleWatch(symbol: string) {
  updatePrefs((prefs) => ({ ...prefs, watchlist: toggle(prefs.watchlist, symbol) }));
}

export function toggleFollow(traderId: string) {
  updatePrefs((prefs) => ({ ...prefs, following: toggle(prefs.following, traderId) }));
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
