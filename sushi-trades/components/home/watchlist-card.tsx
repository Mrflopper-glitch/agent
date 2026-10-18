"use client";

import { usePrefs } from "@/state/prefs";
import { Card, CardHeader } from "../ui/card";
import { WatchTable } from "../markets/watch-table";

/** Your watchlist on Home (first six symbols). */
export function WatchlistCard() {
  const { watchlist } = usePrefs();
  return (
    <Card className="p-4" index={5}>
      <CardHeader title="Watchlist" href="/watchlist" linkLabel="View All" className="mb-3" />
      {watchlist.length ? (
        <WatchTable symbols={watchlist.slice(0, 6)} />
      ) : (
        <p className="py-6 text-center text-sm text-muted">Tap the ☆ next to any symbol to watch it here.</p>
      )}
    </Card>
  );
}
