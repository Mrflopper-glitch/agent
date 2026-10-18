"use client";

import Link from "next/link";
import { money, shortDate, signedMoney } from "@/lib/format";
import type { ClosedPosition, LivePosition } from "@/lib/sim/portfolio";
import { describeInstrument, isBullish, openVerb } from "@/lib/trades";
import { cn } from "@/lib/utils";
import { useData } from "@/state/app-state";
import { Avatar } from "../ui/avatar";
import { AnimatedNumber, Change } from "../ui/numbers";
import type { ReactNode } from "react";

/** Your simulator's open positions, valued live. */
export function OpenPositions({ positions }: { positions: LivePosition[] }) {
  if (positions.length === 0) return <p className="py-8 text-center text-sm text-muted">No open positions. New calls get copied automatically.</p>;
  const sorted = [...positions].sort((a, b) => b.value - a.value);

  return (
    <Table headers={["Trade", "Qty", "Cost", "Value", "P/L"]}>
      {sorted.map((p) => (
        <tr key={p.trade.id} className="border-t border-line">
          <TradeCell position={p} />
          <td className="py-2.5 pr-3 text-right tabular">{formatQty(p.quantity, p.trade.assetClass)}</td>
          <td className="py-2.5 pr-3 text-right tabular">{money(p.cost)}</td>
          <td className="py-2.5 pr-3 text-right font-medium">
            <AnimatedNumber value={p.value} format={money} />
          </td>
          <td className="py-2.5 text-right">
            <span className={cn("block font-semibold tabular", p.pnl >= 0 ? "text-up" : "text-down")}>{signedMoney(p.pnl)}</span>
            <Change value={p.returnPct} digits={1} className="text-[11px]" />
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** Trades your simulator has closed, newest first. */
export function ClosedPositions({ closed }: { closed: ClosedPosition[] }) {
  if (closed.length === 0) return <p className="py-8 text-center text-sm text-muted">Nothing closed yet.</p>;
  const recent = [...closed].sort((a, b) => (b.trade.closedAt ?? 0) - (a.trade.closedAt ?? 0)).slice(0, 25);

  return (
    <Table headers={["Trade", "Qty", "Cost", "P/L", "Closed"]}>
      {recent.map((p) => (
        <tr key={p.trade.id} className="border-t border-line">
          <TradeCell position={p} />
          <td className="py-2.5 pr-3 text-right tabular">{formatQty(p.quantity, p.trade.assetClass)}</td>
          <td className="py-2.5 pr-3 text-right tabular">{money(p.cost)}</td>
          <td className="py-2.5 pr-3 text-right">
            <span className={cn("block font-semibold tabular", p.pnl >= 0 ? "text-up" : "text-down")}>{signedMoney(p.pnl)}</span>
            <Change value={p.returnPct} digits={1} className="text-[11px]" />
          </td>
          <td className="py-2.5 text-right text-xs text-muted">{shortDate(p.trade.closedAt ?? p.trade.openedAt)}</td>
        </tr>
      ))}
    </Table>
  );
}

function TradeCell({ position }: { position: LivePosition | ClosedPosition }) {
  const { tradersById } = useData();
  const { trade } = position;
  const trader = tradersById.get(trade.traderId);
  return (
    <td className="py-2.5 pr-3">
      <span className="flex items-center gap-2.5">
        <Avatar trader={trader} size={26} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className={cn("rounded px-1 text-[10px] font-bold", isBullish(trade) ? "bg-brand-soft text-up" : "bg-down-soft text-down")}>
              {openVerb(trade)}
            </span>
            <Link href={`/markets/${trade.symbol}`} className="font-semibold whitespace-nowrap hover:underline">
              {describeInstrument(trade)}
            </Link>
          </span>
          <Link href={`/traders/${trade.traderId}`} className="block text-[11px] text-muted hover:underline">
            @{trader?.handle}
          </Link>
        </span>
      </span>
    </td>
  );
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="scroll-quiet -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="text-xs text-muted">
            {headers.map((header, i) => (
              <th key={header} className={cn("pb-2 font-medium", i === 0 ? "text-left" : "text-right")}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function formatQty(quantity: number, assetClass: string): string {
  if (assetClass === "crypto") return quantity.toFixed(quantity < 1 ? 4 : 2);
  return `${quantity.toLocaleString()}${assetClass === "option" ? " ct" : ""}`;
}
