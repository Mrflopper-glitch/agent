import type { Metadata } from "next";
import { TradesView } from "@/components/trades/trades-view";

export const metadata: Metadata = { title: "Trades" };

export default function TradesPage() {
  return <TradesView />;
}
