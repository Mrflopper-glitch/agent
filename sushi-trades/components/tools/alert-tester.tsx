"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Info, Send } from "lucide-react";
import { useState } from "react";
import { parseAlert, type ParsedAlert } from "@/lib/discord/parse";
import { price } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useClock, useData } from "@/state/app-state";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { EASE } from "../ui/motion";

const EXAMPLES = [
  "BTO NVDA 140C 11/20 @ 2.50 PT 4 SL 1.40",
  "STC NVDA 140C @ 3.80",
  "Long BTC 67,425 (half size)",
  "Short TSLA at 252.16 PT 230",
  "Trim AMZN @ 182",
  "$AAPL 190 calls 11/27 @ 1.85 lotto",
  "Added more NVDA here. Still early IMO.",
];

/**
 * Type a message the way a trader would post it in Discord and see how Sushi reads it.
 * "Send to feed" pushes it through the same path the Discord bot uses.
 */
export function AlertTester() {
  const { now } = useClock();
  const { traders, refreshDiscord } = useData();
  const [text, setText] = useState(EXAMPLES[0]);
  const [username, setUsername] = useState("noahquant");
  const [secret, setSecret] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const parsed = parseAlert(text, now);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/discord/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
        body: JSON.stringify({
          id: `test-${Date.now()}`,
          authorUsername: username.trim() || "tester",
          channelName: "trade-alerts",
          content: text,
          timestamp: Date.now(),
        }),
      });
      const body = await response.json();
      if (!response.ok) setResult({ ok: false, text: body.error ?? `Failed (${response.status})` });
      else if (body.note) setResult({ ok: false, text: `Saved as a message. ${body.note}` });
      else if (body.action) setResult({ ok: true, text: `Done: ${body.action} recorded for @${username}. Check the Trades page.` });
      else setResult({ ok: true, text: "Saved as a chat message (not a trade). It's in Community." });
      await refreshDiscord();
    } catch {
      setResult({ ok: false, text: "Couldn't reach the server." });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader title="Message tester" />
      <p className="mt-1 text-sm text-muted">Paste a message the way your traders post it. The preview updates as you type.</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            onClick={() => setText(example)}
            className={cn(
              "rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors",
              text === example ? "border-brand/40 bg-brand-soft" : "border-line hover:bg-track",
            )}
          >
            {example}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-3 w-full resize-none rounded-xl border border-line bg-surface p-3 font-mono text-sm outline-none focus:border-faint"
        aria-label="Discord message"
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={parsed.ok ? "trade" : "chat"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className={cn("mt-3 rounded-xl p-3", parsed.ok ? "bg-brand-soft" : "bg-track")}
        >
          {parsed.ok ? (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-up">
                <CircleCheck className="size-4" /> Trade alert detected
              </p>
              <Fields alert={parsed.alert} />
            </>
          ) : (
            <p className="flex items-start gap-1.5 text-[13px] text-ink/80">
              <Info className="mt-0.5 size-4 shrink-0 text-muted" /> Not a trade, so it would show as a chat message. {parsed.reason}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          Post as (Discord username)
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            list="tester-traders"
            className="mt-1 h-9 w-full rounded-lg border border-line px-3 text-sm font-normal outline-none focus:border-faint"
          />
          <datalist id="tester-traders">
            {traders.map((t) => (
              <option key={t.id} value={t.discordUsername ?? t.id} />
            ))}
          </datalist>
        </label>
        <label className="text-xs font-semibold">
          Ingest secret <span className="font-normal text-muted">(only if your server has one)</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-line px-3 text-sm font-normal outline-none focus:border-faint"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={send} disabled={sending || !text.trim()}>
          <Send className="size-4" /> {sending ? "Sending…" : "Send to feed"}
        </Button>
        <AnimatePresence>
          {result && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={cn("text-[13px]", result.ok ? "text-up" : "text-ink/80")}
            >
              {result.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function Fields({ alert }: { alert: ParsedAlert }) {
  const sizeLabel = alert.size === 1 ? "Normal" : alert.size === 0.5 ? "Half" : alert.size === 0.25 ? "Lotto (¼)" : `${alert.size}×`;
  const fields: [string, string][] = [
    ["Action", alert.action === "trim" ? `Trim ${Math.round((alert.fraction ?? 0.5) * 100)}%` : alert.action === "open" ? `Open ${alert.direction ?? ""}` : "Close"],
    ["Ticker", alert.symbol],
    ["Type", alert.option ? `${alert.option.strike} ${alert.option.type} · exp ${alert.option.expiry}` : alert.assetClass],
    ["Price", alert.price !== undefined ? price(alert.price) : "market"],
  ];
  if (alert.target !== undefined) fields.push(["Target", price(alert.target)]);
  if (alert.stop !== undefined) fields.push(["Stop", price(alert.stop)]);
  if (alert.action === "open") fields.push(["Size", sizeLabel]);

  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] text-muted">{label}</dt>
          <dd className="text-[13px] font-semibold capitalize">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
