"use client";

import { useState } from "react";
import { TICKERS } from "@/lib/market/tickers";
import { RANGES, type Range } from "@/state/derived";
import { Card, CardHeader } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Tabs } from "../ui/tabs";
import { MarketTile } from "./market-tile";
import { WatchTable } from "./watch-table";

const indices = TICKERS.filter((t) => t.kind === "index").map((t) => t.symbol);
const crypto = TICKERS.filter((t) => t.kind === "crypto").map((t) => t.symbol);
const stocks = TICKERS.filter((t) => t.kind === "stock").map((t) => t.symbol);

/** Markets: indices and crypto as tiles, every stock in a live table. */
export function MarketsView() {
  const [range, setRange] = useState<Range>("1D");

  return (
    <>
      <PageHeader title="Markets" subtitle="Live prices for everything your traders trade.">
        <Tabs tabs={RANGES} value={range} onChange={setRange} variant="solid" />
      </PageHeader>
      <div className="space-y-4">
        <Card className="p-4">
          <CardHeader title="Indices" />
          <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {indices.map((symbol) => (
              <MarketTile key={symbol} symbol={symbol} range={range} />
            ))}
          </div>
        </Card>
        <Card className="p-4" index={1}>
          <CardHeader title="Crypto" />
          <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
            {crypto.map((symbol) => (
              <MarketTile key={symbol} symbol={symbol} range={range} />
            ))}
          </div>
        </Card>
        <Card className="p-4" index={2}>
          <CardHeader title="Stocks" className="mb-3" />
          <WatchTable symbols={stocks} showName />
        </Card>
      </div>
    </>
  );
}
