import { getTicker } from "@/lib/market/tickers";
import type { Trader } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A trader's round avatar: their initials on their color. */
export function Avatar({ trader, size = 32, className }: { trader: Trader | undefined; size?: number; className?: string }) {
  const name = trader?.name || trader?.handle || "?";
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.28), transparent 60%), ${trader?.color ?? "#9ca3af"}`,
      }}
    >
      {initials}
    </span>
  );
}

/** A small rounded square standing in for a company or coin logo. */
export function TickerIcon({ symbol, size = 28, className }: { symbol: string; size?: number; className?: string }) {
  const ticker = getTicker(symbol);
  const label = ticker.kind === "index" ? ticker.name.slice(0, 1) : symbol.slice(0, symbol.length > 3 ? 1 : 2);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.4, background: ticker.color }}
    >
      {label}
    </span>
  );
}
