import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/portfolio-view";

export const metadata: Metadata = { title: "7-Figure Simulator" };

export default function PortfolioPage() {
  return <PortfolioView />;
}
