"use client";

import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { tradeEvents } from "@/lib/feed";
import { pickIdeas } from "@/lib/ideas";
import { isOpen } from "@/lib/trades";
import { useData } from "@/state/app-state";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { listItem } from "../ui/motion";
import { PageHeader } from "../ui/page-header";
import { Tabs } from "../ui/tabs";
import { IdeaCard } from "./idea-card";
import { TradeEventRow } from "./trade-event-row";

const SHOW = ["All", "Entries", "Exits", "Still open"] as const;
const ASSETS = ["All", "Stocks", "Options", "Crypto"] as const;
const PAGE = 40;

/** The live feed of every call from every trader. New calls slide in at the top. */
export function TradesView() {
  const { trades, tradersById } = useData();
  const [show, setShow] = useState<(typeof SHOW)[number]>("All");
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("All");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const events = useMemo(() => {
    const q = query.trim().toUpperCase();
    return tradeEvents(trades).filter(({ kind, trade }) => {
      if (show === "Entries" && kind !== "open") return false;
      if (show === "Exits" && kind !== "close") return false;
      if (show === "Still open" && !(kind === "open" && isOpen(trade))) return false;
      if (asset === "Stocks" && trade.assetClass !== "stock") return false;
      if (asset === "Options" && trade.assetClass !== "option") return false;
      if (asset === "Crypto" && trade.assetClass !== "crypto") return false;
      if (q && !trade.symbol.includes(q) && !tradersById.get(trade.traderId)?.handle.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [trades, tradersById, show, asset, query]);

  const ideas = useMemo(() => pickIdeas(trades, tradersById, "Trending").slice(0, 4), [trades, tradersById]);

  return (
    <>
      <PageHeader title="Trades" subtitle="Every call from your Discord traders, the moment it's posted." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs tabs={SHOW} value={show} onChange={setShow} variant="solid" />
            <Tabs tabs={ASSETS} value={asset} onChange={setAsset} variant="soft" />
            <label className="relative ml-auto w-full sm:w-52">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ticker or trader"
                className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-faint"
              />
            </label>
          </div>
          <p className="mt-3 mb-1 text-xs text-muted">{events.length.toLocaleString()} calls</p>
          <div>
            <AnimatePresence initial={false}>
              {events.slice(0, limit).map((event) => (
                <motion.div key={event.key} layout="position" {...listItem}>
                  <TradeEventRow event={event} trader={tradersById.get(event.trade.traderId)} />
                </motion.div>
              ))}
            </AnimatePresence>
            {events.length === 0 && <p className="py-10 text-center text-sm text-muted">No calls match these filters.</p>}
          </div>
          {events.length > limit && (
            <div className="mt-3 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>
                Show more
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4" index={1}>
            <CardHeader title="Trending ideas" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {ideas.map((trade) => (
                <IdeaCard key={trade.id} trade={trade} trader={tradersById.get(trade.traderId)} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
