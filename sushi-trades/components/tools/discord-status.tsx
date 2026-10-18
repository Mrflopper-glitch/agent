"use client";

import { Bot } from "lucide-react";
import { useState } from "react";
import { timeAgoLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useClock, useData } from "@/state/app-state";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";

const STEPS = [
  <>
    Create a bot at <b>discord.com/developers/applications</b> → <b>Bot</b>, and switch on <b>Message Content Intent</b>.
  </>,
  <>
    Invite it to your server with the <b>View Channels</b> and <b>Read Message History</b> permissions.
  </>,
  <>
    In <code>.env.local</code> set <code>DISCORD_BOT_TOKEN</code>, <code>DISCORD_CHANNEL_IDS</code> (the channels to watch),
    <code>DISCORD_INGEST_SECRET</code> (any long random string) and <code>SUSHI_URL</code>.
  </>,
  <>
    Run <code>npm run bot</code>. New messages appear here within a few seconds.
  </>,
];

/** Is the Discord bot delivering? Plus the steps to connect it. */
export function DiscordStatus() {
  const { discord, refreshDiscord } = useData();
  const { now } = useClock();
  const [clearing, setClearing] = useState(false);
  const connected = discord.lastMessageAt !== null;

  async function clear() {
    if (!confirm("Delete every trader, trade and message received from Discord?")) return;
    setClearing(true);
    const response = await fetch("/api/discord", { method: "DELETE" });
    if (!response.ok) alert((await response.json()).error ?? "Couldn't clear the data.");
    await refreshDiscord();
    setClearing(false);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5" index={1}>
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#5865f2] text-white">
            <Bot className="size-6" />
          </span>
          <div>
            <p className="font-bold">Discord connection</p>
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <span className={cn("size-2 rounded-full", connected ? "live-dot bg-brand" : "bg-faint")} />
              {connected ? `Receiving · last message ${timeAgoLong(discord.lastMessageAt!, now)}` : "Waiting for the first message"}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Traders", discord.traders.length],
            ["Trades", discord.trades.length],
            ["Messages", discord.messages.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-track/70 py-2.5">
              <dd className="text-lg font-bold tabular">{value}</dd>
              <dt className="text-[11px] text-muted">{label}</dt>
            </div>
          ))}
        </dl>
        {discord.messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={clearing} className="mt-3 text-down hover:text-down">
            {clearing ? "Clearing…" : "Clear Discord data"}
          </Button>
        )}
      </Card>

      <Card className="p-4 sm:p-5" index={2}>
        <CardHeader title="Connect your server" />
        <ol className="mt-3 space-y-3">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 text-[13px] leading-relaxed [&_code]:rounded [&_code]:bg-track [&_code]:px-1 [&_code]:text-[12px]">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">
          Prefer real traders only? Set <code className="rounded bg-track px-1">NEXT_PUBLIC_DEMO_DATA=false</code> to hide the demo traders.
        </p>
      </Card>
    </div>
  );
}
