import { CommunityCard } from "@/components/home/community-card";
import { Hero } from "@/components/home/hero";
import { LearningPath } from "@/components/home/learning-path";
import { LiveCard } from "@/components/home/live-card";
import { MarketOverview } from "@/components/home/market-overview";
import { PortfolioCard } from "@/components/home/portfolio-card";
import { QuickLinks } from "@/components/home/quick-links";
import { TopTraders } from "@/components/home/top-traders";
import { TradeIdeas } from "@/components/home/trade-ideas";
import { WatchlistCard } from "@/components/home/watchlist-card";

/** Home: the dashboard from the design mockup. Main column on the left, rail on the right. */
export default function HomePage() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Hero />
        <QuickLinks />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <MarketOverview />
          <PortfolioCard />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.85fr)]">
          <WatchlistCard />
          <div className="min-w-0 space-y-4">
            <TradeIdeas />
            <LearningPath />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <LiveCard />
        <TopTraders />
        <CommunityCard />
      </div>
    </div>
  );
}
