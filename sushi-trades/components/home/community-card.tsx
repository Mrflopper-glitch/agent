"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useData } from "@/state/app-state";
import { usePrefs } from "@/state/prefs";
import { Card, CardHeader } from "../ui/card";
import { listItem } from "../ui/motion";
import { Tabs } from "../ui/tabs";
import { MessageCard } from "../community/message-card";

export const COMMUNITY_TABS = ["For You", "Following", "Discussions"] as const;
export type CommunityTab = (typeof COMMUNITY_TABS)[number];

/** Filters the Discord messages for a community tab. */
export function useCommunityFeed(tab: CommunityTab) {
  const { messages } = useData();
  const { following } = usePrefs();
  return useMemo(() => {
    if (tab === "Following") return messages.filter((m) => following.includes(m.traderId));
    if (tab === "Discussions") return messages.filter((m) => !m.tradeId);
    return messages;
  }, [messages, following, tab]);
}

/** "Community": the latest Discord messages, live. */
export function CommunityCard() {
  const { tradersById, trades } = useData();
  const [tab, setTab] = useState<CommunityTab>("For You");
  const feed = useCommunityFeed(tab).slice(0, 3);
  const tradesById = useMemo(() => new Map(trades.map((t) => [t.id, t])), [trades]);

  return (
    <Card className="p-4" index={3}>
      <CardHeader title="Community" href="/community" />
      <Tabs tabs={COMMUNITY_TABS} value={tab} onChange={setTab} variant="outline" className="mt-3" />
      <div className="mt-1 divide-y divide-line">
        <AnimatePresence initial={false} mode="popLayout">
          {feed.map((message) => (
            <motion.div key={message.id} layout {...listItem}>
              <MessageCard message={message} trader={tradersById.get(message.traderId)} trade={message.tradeId ? tradesById.get(message.tradeId) : undefined} />
            </motion.div>
          ))}
        </AnimatePresence>
        {feed.length === 0 && <p className="py-8 text-center text-sm text-muted">Nothing here yet.</p>}
      </div>
    </Card>
  );
}
