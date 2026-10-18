/**
 * The simulated market counts time in whole days since EPOCH.
 * Day 0 is Jan 1 2025, day 1 is Jan 2 2025, and so on.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The first day of simulated price history. */
export const EPOCH = Date.UTC(2025, 0, 1);

/** Which simulated day a timestamp falls on. */
export function dayIndex(ms: number): number {
  return Math.floor((ms - EPOCH) / DAY_MS);
}

/** Midnight (UTC) at the start of a simulated day. */
export function dayStart(day: number): number {
  return EPOCH + day * DAY_MS;
}

export function isWeekend(day: number): boolean {
  const weekday = new Date(dayStart(day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}
