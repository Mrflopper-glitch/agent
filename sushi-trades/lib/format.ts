/** Number and date formatting used across the UI. */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** $184,325.12 */
export function money(value: number): string {
  return usd.format(value);
}

/** $184,325 */
export function moneyWhole(value: number): string {
  return usdWhole.format(value);
}

/** $1.2M, $250K */
export function moneyCompact(value: number): string {
  return "$" + compact.format(value);
}

/** +$12,486.32 / -$80.10 */
export function signedMoney(value: number): string {
  return (value >= 0 ? "+" : "-") + usd.format(Math.abs(value));
}

/** +$12,486 / -$80 */
export function signedMoneyWhole(value: number): string {
  return (value >= 0 ? "+" : "-") + usdWhole.format(Math.abs(value));
}

/** 5,780.29 (prices without a $ sign). Tiny prices keep more decimals. */
export function price(value: number): string {
  if (value > 0 && value < 1) return value.toFixed(3);
  return plain.format(value);
}

/** +7.28% / -0.48% from a fraction (0.0728). */
export function percent(fraction: number, digits = 2): string {
  const value = fraction * 100;
  return (value >= 0 ? "+" : "") + value.toFixed(digits) + "%";
}

/** 48.2K */
export function count(value: number): string {
  return compact.format(value);
}

/** "now", "5m", "2h", "3d", "Oct 2" */
export function timeAgo(timestamp: number, now: number): string {
  const seconds = Math.max(0, (now - timestamp) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return shortDate(timestamp);
}

/** "just now", "5m ago", "2h ago", "Oct 2" */
export function timeAgoLong(timestamp: number, now: number): string {
  const short = timeAgo(timestamp, now);
  if (short === "now") return "just now";
  return /^\d/.test(short) ? `${short} ago` : short;
}

/** "Oct 2" */
export function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Oct 2, 2026" */
export function longDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
