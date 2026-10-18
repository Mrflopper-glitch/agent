import type { Metadata } from "next";
import { TradersView } from "@/components/traders/traders-view";

export const metadata: Metadata = { title: "Traders" };

export default function TradersPage() {
  return <TradersView />;
}
