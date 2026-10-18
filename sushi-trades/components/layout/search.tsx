"use client";

import { AnimatePresence, motion } from "motion/react";
import { Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { price } from "@/lib/format";
import { TICKERS } from "@/lib/market/tickers";
import { cn } from "@/lib/utils";
import { useData, usePrices } from "@/state/app-state";
import { Avatar, TickerIcon } from "../ui/avatar";

interface Result {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
}

/** Search traders and symbols. Press "/" anywhere to jump here. */
export function Search({ className }: { className?: string }) {
  const router = useRouter();
  const { traders } = useData();
  const { priceOf } = usePrices();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const results: Result[] = q
    ? [
        ...traders
          .filter((t) => t.handle.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
          .slice(0, 4)
          .map((t) => ({
            key: `trader-${t.id}`,
            href: `/traders/${t.id}`,
            title: `@${t.handle}`,
            subtitle: t.name,
            icon: <Avatar trader={t} size={28} />,
          })),
        ...TICKERS.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
          .slice(0, 5)
          .map((t) => ({
            key: `ticker-${t.symbol}`,
            href: `/markets/${t.symbol}`,
            title: t.symbol,
            subtitle: `${t.name} · ${price(priceOf(t.symbol))}`,
            icon: <TickerIcon symbol={t.symbol} size={28} />,
          })),
      ]
    : [];

  function go(result: Result | undefined) {
    if (!result) return;
    router.push(result.href);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") setHighlight((h) => Math.min(h + 1, results.length - 1));
    else if (event.key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
    else if (event.key === "Enter") go(results[highlight]);
    else if (event.key === "Escape") input.current?.blur();
    else return;
    event.preventDefault();
  }

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-faint" />
      <input
        ref={input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Search traders, stocks, crypto…"
        aria-label="Search"
        className="h-11 w-full rounded-xl border border-transparent bg-track/80 pr-10 pl-11 text-sm outline-none transition-colors placeholder:text-faint focus:border-line focus:bg-surface"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line bg-surface px-1.5 text-[11px] text-faint sm:block">
        /
      </kbd>

      <AnimatePresence>
        {open && q && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-lift"
          >
            {results.length === 0 && <p className="px-3 py-3 text-sm text-muted">No traders or symbols match “{query}”.</p>}
            {results.map((result, i) => (
              <button
                key={result.key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(result)}
                onMouseEnter={() => setHighlight(i)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === highlight && "bg-track")}
              >
                {result.icon}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{result.title}</span>
                  <span className="block truncate text-xs text-muted">{result.subtitle}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
