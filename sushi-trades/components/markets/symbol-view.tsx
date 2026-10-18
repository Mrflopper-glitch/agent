"use client";

import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { price, shortDate } from "@/lib/format";
import { closeOn, intradayPrices } from "@/lib/market/prices";
import { getTicker } from "@/lib/market/tickers";
import { dayStart, DAY_MS } from "@/lib/market/time";
import { byCloseDate, isOpen } from "@/lib/trades";
import { useClock, useData } from "@/state/app-state";
import { RANGES, seriesChange, useQuote, useSeries, type Range } from "@/state/derived";
import { AreaChart } from "../charts/area-chart";
import { TickerIcon } from "../ui/avatar";
import { Card, CardHeader } from "../ui/card";
import { appear } from "../ui/motion";
import { AnimatedNumber, Change } from "../ui/numbers";
import { StatTile } from "../ui/stat-tile";
import { Tabs } from "../ui/tabs";
import { TradeTable } from "../trades/trade-table";
import { WatchStar } from "./watch-star";

// The 1D chart covers US market hours (13:30–20:00 UTC).
const SESSION_START_MS = 13.5 * 3_600_000;
const SESSION_MS = 6.5 * 3_600_000;

/** One symbol: live price, chart, and which of your traders are in it. */
export function SymbolView({ symbol }: { symbol: string }) {
  const ticker = getTicker(symbol);
  const { today } = useClock();
  const { trades } = useData();
  const quote = useQuote(symbol);
  const [range, setRange] = useState<Range>("1M");
  const series = useSeries(symbol, range);
  const yearSeries = useSeries(symbol, "1Y");

  const data = series.map((y, i) => ({
    x:
      range === "1D"
        ? dayStart(today) + SESSION_START_MS + (i / (series.length - 1)) * SESSION_MS
        : dayStart(today) - (series.length - 1 - i) * DAY_MS,
    y,
  }));

  const intraday = useMemo(() => intradayPrices(symbol, today), [symbol, today]);
  const symbolTrades = useMemo(() => trades.filter((t) => t.symbol === symbol).sort((a, b) => b.openedAt - a.openedAt), [trades, symbol]);
  const holding = symbolTrades.filter(isOpen);

  return (
    <div className="space-y-4">
      <motion.div {...appear()}>
        <Link href="/markets" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Markets
        </Link>
      </motion.div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <TickerIcon symbol={symbol} size={52} />
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              {ticker.kind === "index" ? ticker.name : symbol} <WatchStar symbol={symbol} />
            </h1>
            <p className="text-sm text-muted">
              {ticker.name} · {ticker.kind === "index" ? "Index" : ticker.kind === "crypto" ? "Crypto" : "Stock"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold tracking-tight">
              <AnimatedNumber value={quote.price} format={(v) => (ticker.kind === "index" ? price(v) : "$" + price(v))} />
            </p>
            <Change value={quote.change} className="text-sm" /> <span className="text-sm text-muted">today</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Change value={seriesChange(series)} className="text-sm" />
          <Tabs tabs={RANGES} value={range} onChange={setRange} variant="soft" />
        </div>
        <AreaChart
          className="mt-2"
          data={data}
          formatValue={price}
          formatLabel={(x) => (range === "1D" ? new Date(x).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : shortDate(x))}
          revealKey={range}
          height={280}
        />
      </Card>

      <motion.div {...appear(1)} className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Previous close" value={price(quote.previousClose)} />
        <StatTile label="Day range" value={`${price(Math.min(...intraday))} – ${price(Math.max(...intraday))}`} />
        <StatTile label="1 year" value={`${seriesChange(yearSeries) >= 0 ? "+" : ""}${(seriesChange(yearSeries) * 100).toFixed(1)}%`} tone={seriesChange(yearSeries)} />
        <StatTile label="1Y high" value={price(Math.max(...yearSeries))} note={`low ${price(Math.min(...yearSeries))}`} />
        <StatTile label="Traders in it" value={new Set(holding.map((t) => t.traderId)).size} note={`${holding.length} open trades`} />
      </motion.div>

      <Card className="p-4" index={2}>
        <CardHeader title={`Who's trading ${symbol}`} className="mb-2" />
        <TradeTable trades={holding} showTrader empty={`None of your traders hold ${symbol} right now.`} />
      </Card>
      <Card className="p-4" index={3}>
        <CardHeader title="Recent calls" className="mb-2" />
        <TradeTable
          trades={byCloseDate(symbolTrades).slice(0, 15)}
          showTrader
          empty={`No closed ${symbol} trades yet. Yesterday's close was ${price(closeOn(symbol, today - 1))}.`}
        />
      </Card>
    </div>
  );
}
