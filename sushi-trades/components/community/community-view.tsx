"use client";

import { AnimatePresence, motion } from "motion/react";
import { Hash } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { count } from "@/lib/format";
import { useData } from "@/state/app-state";
import { usePrefs } from "@/state/prefs";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { listItem } from "../ui/motion";
import { PageHeader } from "../ui/page-header";
import { Tabs } from "../ui/tabs";
import { COMMUNITY_TABS, useCommunityFeed, type CommunityTab } from "../home/community-card";
import { FollowButton } from "../traders/follow-button";
import { MessageCard } from "./message-card";

const PAGE = 30;

/** Community: the Discord feed, live, plus who to follow. */
export function CommunityView() {
  const { traders, tradersById, trades, messages } = useData();
  const { following } = usePrefs();
  const [tab, setTab] = useState<CommunityTab>("For You");
  const [limit, setLimit] = useState(PAGE);
  const feed = useCommunityFeed(tab);
  const tradesById = useMemo(() => new Map(trades.map((t) => [t.id, t])), [trades]);

  const channels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const message of messages) counts.set(message.channel, (counts.get(message.channel) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [messages]);

  const suggestions = traders.filter((t) => !following.includes(t.id)).slice(0, 5);

  return (
    <>
      <PageHeader title="Community" subtitle="Everything your traders post in Discord, as it happens." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 p-4">
          <Tabs tabs={COMMUNITY_TABS} value={tab} onChange={setTab} variant="outline" className="max-w-md" />
          <div className="mt-1 divide-y divide-line">
            <AnimatePresence initial={false}>
              {feed.slice(0, limit).map((message) => (
                <motion.div key={message.id} layout="position" {...listItem}>
                  <MessageCard
                    message={message}
                    trader={tradersById.get(message.traderId)}
                    trade={message.tradeId ? tradesById.get(message.tradeId) : undefined}
                    showChannel
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {feed.length === 0 && (
              <p className="py-10 text-center text-sm text-muted">
                {tab === "Following" ? "Follow a few traders to fill this tab." : "No messages yet."}
              </p>
            )}
          </div>
          {feed.length > limit && (
            <div className="mt-3 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>
                Show more
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4" index={1}>
            <CardHeader title="Who to follow" href="/traders" />
            <ul className="mt-2">
              {suggestions.map((trader) => (
                <li key={trader.id} className="flex items-center gap-3 py-2">
                  <Link href={`/traders/${trader.id}`}>
                    <Avatar trader={trader} size={34} />
                  </Link>
                  <Link href={`/traders/${trader.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">@{trader.handle}</span>
                    <span className="block text-xs text-muted">{count(trader.followers)} followers</span>
                  </Link>
                  <FollowButton traderId={trader.id} />
                </li>
              ))}
              {suggestions.length === 0 && <p className="py-4 text-sm text-muted">You follow everyone. Nice.</p>}
            </ul>
          </Card>
          <Card className="p-4" index={2}>
            <CardHeader title="Channels" />
            <ul className="mt-2 space-y-1">
              {channels.map(([channel, total]) => (
                <li key={channel} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-track">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Hash className="size-4 text-faint" />
                    {channel}
                  </span>
                  <span className="text-xs text-muted tabular">{total}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
