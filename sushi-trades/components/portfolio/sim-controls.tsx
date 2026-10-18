"use client";

import { Check } from "lucide-react";
import { moneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useData } from "@/state/app-state";
import { setSim, usePrefs, type SimPeriod } from "@/state/prefs";
import { Avatar } from "../ui/avatar";
import { Card, CardHeader } from "../ui/card";
import { Tabs } from "../ui/tabs";
import type { CSSProperties, ReactNode } from "react";

const CASH_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000];
const PERIODS: SimPeriod[] = ["1M", "3M", "6M", "1Y", "ALL"];

/** The simulator's knobs: budget, position size, start date and which traders to copy. Changes apply instantly. */
export function SimControls() {
  const { sim } = usePrefs();
  const { traders } = useData();
  const selected = sim.traderIds ?? traders.map((t) => t.id);

  function toggleTrader(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSim({ traderIds: next.length === traders.length ? null : next });
  }

  return (
    <Card className="p-4" index={1}>
      <CardHeader title="Simulator settings" />

      <Section label="Starting cash">
        <div className="flex flex-wrap gap-1.5">
          {CASH_PRESETS.map((cash) => (
            <Chip key={cash} active={sim.startingCash === cash} onClick={() => setSim({ startingCash: cash })}>
              {moneyCompact(cash)}
            </Chip>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 rounded-lg border border-line px-3 focus-within:border-faint">
          <span className="text-sm text-muted">$</span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={sim.startingCash}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 100) setSim({ startingCash: value });
            }}
            className="h-9 w-full bg-transparent text-sm outline-none tabular"
            aria-label="Starting cash"
          />
        </label>
      </Section>

      <Section label="Position size" value={`${(sim.positionPct * 100).toFixed(1).replace(/\.0$/, "")}% per trade`}>
        <input
          type="range"
          min={0.01}
          max={0.25}
          step={0.005}
          value={sim.positionPct}
          onChange={(e) => setSim({ positionPct: Number(e.target.value) })}
          className="range my-2 w-full"
          style={{ "--fill": `${((sim.positionPct - 0.01) / 0.24) * 100}%` } as CSSProperties}
          aria-label="Position size"
        />
        <p className="text-xs text-muted">Each copied trade uses this share of your account. Bigger means faster growth and bigger swings.</p>
      </Section>

      <Section label="Start copying">
        <Tabs tabs={PERIODS} value={sim.period} onChange={(period) => setSim({ period })} variant="solid" labels={{ ALL: "All", "1Y": "1Y ago", "6M": "6M", "3M": "3M", "1M": "1M" }} />
      </Section>

      <Section
        label="Traders to copy"
        value={
          <button onClick={() => setSim({ traderIds: sim.traderIds === null ? [] : null })} className="font-semibold text-up">
            {sim.traderIds === null ? "Clear" : "Select all"}
          </button>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {traders.map((trader) => {
            const on = selected.includes(trader.id);
            return (
              <button
                key={trader.id}
                onClick={() => toggleTrader(trader.id)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs font-medium transition-all",
                  on ? "border-brand/40 bg-brand-soft text-ink" : "border-line bg-surface text-muted hover:border-faint",
                )}
              >
                <Avatar trader={trader} size={20} />@{trader.handle}
                {on && <Check className="size-3 text-up" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </Section>
    </Card>
  );
}

function Section({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4 border-t border-line pt-4 first-of-type:border-0">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        {value && <span className="text-muted">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-ink text-white" : "bg-track text-ink/70 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
