"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { IDEA_TABS, pickIdeas, type IdeaTab } from "@/lib/ideas";
import { useData } from "@/state/app-state";
import { Card, CardHeader } from "../ui/card";
import { Tabs } from "../ui/tabs";
import { IdeaCard } from "../trades/idea-card";

/** "Explore Trade Ideas": open trades from your traders, by category. */
export function TradeIdeas() {
  const { trades, tradersById } = useData();
  const [tab, setTab] = useState<IdeaTab>("Trending");
  const ideas = pickIdeas(trades, tradersById, tab).slice(0, 3);

  return (
    <Card className="p-4" index={6}>
      <CardHeader title="Explore Trade Ideas" href="/trades" />
      <Tabs tabs={IDEA_TABS} value={tab} onChange={setTab} variant="solid" className="scroll-quiet mt-3 overflow-x-auto pb-1" />
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mt-3 grid gap-3 sm:grid-cols-3"
        >
          {ideas.map((trade) => (
            <IdeaCard key={trade.id} trade={trade} trader={tradersById.get(trade.traderId)} />
          ))}
          {ideas.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted">No open {tab.toLowerCase()} ideas right now.</p>}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}
