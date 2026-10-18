/**
 * Preview build entry: the whole Sushi Trades app running in the browser
 * with no server, so it can be shared as a single hosted page.
 *
 * It reuses every page and component from the real app. Only three things
 * are swapped: Next.js routing (→ ./router.ts), the next/link and
 * next/navigation imports (→ ./shims) and the Discord API (→ ./fake-api.ts).
 *
 * Build it with:  npm run preview:build   (output: .preview-dist/)
 */
import { useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./preview.css";
import { installFakeApi, loadDiscord } from "./fake-api";
import { usePath } from "./router";
import HomePage from "@/app/page";
import ToolsPage from "@/app/tools/page";
import LearnPage from "@/app/learn/page";
import ChallengesPage from "@/app/challenges/page";
import NotFound from "@/app/not-found";
import { MotionSettings } from "@/components/layout/motion-settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TradeToasts } from "@/components/layout/trade-toasts";
import { CommunityView } from "@/components/community/community-view";
import { MarketsView } from "@/components/markets/markets-view";
import { SymbolView } from "@/components/markets/symbol-view";
import { WatchlistView } from "@/components/markets/watchlist-view";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { TraderView } from "@/components/traders/trader-view";
import { TradersView } from "@/components/traders/traders-view";
import { TradesView } from "@/components/trades/trades-view";
import { AppState } from "@/state/app-state";

installFakeApi();
const startedAt = Date.now();
const initialDiscord = loadDiscord();

/** URL path → page. Mirrors the folders in app/. */
const ROUTES: [RegExp, (match: RegExpMatchArray) => ReactNode][] = [
  [/^\/$/, () => <HomePage />],
  [/^\/markets$/, () => <MarketsView />],
  [/^\/markets\/([^/]+)$/, (m) => <SymbolView symbol={decodeURIComponent(m[1]).toUpperCase()} />],
  [/^\/trades$/, () => <TradesView />],
  [/^\/traders$/, () => <TradersView />],
  [/^\/traders\/([^/]+)$/, (m) => <TraderView traderId={decodeURIComponent(m[1]).toLowerCase()} />],
  [/^\/watchlist$/, () => <WatchlistView />],
  [/^\/community$/, () => <CommunityView />],
  [/^\/portfolio$/, () => <PortfolioView />],
  [/^\/learn$/, () => <LearnPage />],
  [/^\/challenges$/, () => <ChallengesPage />],
  [/^\/tools$/, () => <ToolsPage />],
];

function Page({ path }: { path: string }) {
  for (const [pattern, render] of ROUTES) {
    const match = path.match(pattern);
    if (match) return <>{render(match)}</>;
  }
  return <NotFound />;
}

function App() {
  const path = usePath();
  useEffect(() => window.scrollTo(0, 0), [path]);

  return (
    <MotionSettings>
      <div className="flex min-h-dvh bg-canvas font-sans text-base text-ink antialiased">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <AppState serverNow={startedAt} initialDiscord={initialDiscord}>
            <Topbar />
            {/* key: each page gets a fresh mount, so its entrance animation plays */}
            <main key={path} className="px-4 pb-6 sm:px-6 lg:px-8">
              <Page path={path} />
            </main>
            <TradeToasts />
          </AppState>
          <p className="px-4 pb-8 text-xs text-faint sm:px-6 lg:px-8">
            Preview build. Prices are simulated, and messages you send from Tools are saved only in this browser.
          </p>
        </div>
      </div>
    </MotionSettings>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
