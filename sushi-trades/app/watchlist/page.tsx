import type { Metadata } from "next";
import { WatchlistView } from "@/components/markets/watchlist-view";

export const metadata: Metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  return <WatchlistView />;
}
