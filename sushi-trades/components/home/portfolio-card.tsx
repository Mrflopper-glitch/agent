"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { money, moneyCompact, percent, signedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSimulation } from "@/state/derived";
import { Sparkline } from "../charts/sparkline";
import { Card, CardHeader } from "../ui/card";
import { AnimatedNumber } from "../ui/numbers";

const HIDDEN = "•••••";

/** "My Portfolio": your simulator account at a glance. The eye hides the numbers. */
export function PortfolioCard() {
  const { snapshot } = useSimulation();
  const [hidden, setHidden] = useState(false);
  const show = (text: string) => (hidden ? HIDDEN : text);
  const up = snapshot.dayChange >= 0;

  return (
    <Card className="flex flex-col p-4" index={4}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            My Portfolio
            <button onClick={() => setHidden(!hidden)} aria-label={hidden ? "Show balances" : "Hide balances"} className="text-ink/70 hover:text-ink">
              {hidden ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </span>
        }
        href="/portfolio"
        linkLabel="View All"
      />
      <p className="mt-3 text-[28px] leading-none font-extrabold tracking-tight">
        {hidden ? HIDDEN : <AnimatedNumber value={snapshot.equity} format={money} />}
      </p>
      <p className="mt-2 mb-3 text-[13px]">
        <span className={cn("font-semibold tabular", up ? "text-up" : "text-down")}>
          {show(`${signedMoney(snapshot.dayChange)} (${percent(snapshot.dayChangePct)})`)}
        </span>{" "}
        <span className="text-muted">Today</span>
      </p>
      <Sparkline values={snapshot.points.slice(-90).map((p) => p.equity)} className="mb-3 h-12 w-full" />
      <dl className="mt-auto grid grid-cols-4 gap-2 border-t border-line pt-3 text-[11px]">
        <Stat label="Cash" value={show(moneyCompact(snapshot.cash))} />
        <Stat label="Invested" value={show(moneyCompact(snapshot.invested))} />
        <Stat label="Day P/L" value={percent(snapshot.dayChangePct, 1)} tone={snapshot.dayChangePct} />
        <Stat label="Total P/L" value={percent(snapshot.totalReturn, Math.abs(snapshot.totalReturn) >= 1 ? 0 : 1)} tone={snapshot.totalReturn} />
      </dl>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-[13px] font-semibold tabular", tone !== undefined && (tone >= 0 ? "text-up" : "text-down"))}>{value}</dd>
    </div>
  );
}
