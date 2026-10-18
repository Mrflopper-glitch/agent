import type { Metadata, Viewport } from "next";
import { Caveat, Inter } from "next/font/google";
import { Suspense } from "react";
import { AppData } from "@/components/layout/app-data";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { MotionSettings } from "@/components/layout/motion-settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TradeToasts } from "@/components/layout/trade-toasts";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: { default: "Sushi Trades", template: "%s · Sushi Trades" },
  description: "Track your Discord traders' calls live and simulate a 7-figure portfolio by copying them.",
};

export const viewport: Viewport = {
  themeColor: "#fbfbfc",
};

/**
 * The frame around every page: sidebar on the left, top bar, then the page.
 * The sidebar is static; everything else waits for live data (see AppData).
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable} antialiased`}>
      <body className="font-sans">
        <MotionSettings>
          <div className="flex min-h-dvh">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <Suspense fallback={<AppSkeleton />}>
                <AppData>
                  <Topbar />
                  <main className="px-4 pb-10 sm:px-6 lg:px-8">{children}</main>
                  <TradeToasts />
                </AppData>
              </Suspense>
            </div>
          </div>
        </MotionSettings>
      </body>
    </html>
  );
}
