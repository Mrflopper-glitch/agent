"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "../brand/logo";
import { SPRING } from "../ui/motion";
import { isActive, NAV_ITEMS } from "./nav";

/** The left menu on desktop. The green highlight slides to the current page. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col px-4 py-5 lg:flex">
      <Link href="/" className="mb-8 px-3 text-ink" aria-label="Sushi Trades home">
        <Logo className="h-9" />
      </Link>
      {/* Reading the URL can wait for the request on some pages, so the menu renders without a highlight until then. */}
      <Suspense fallback={<NavList pathname={null} />}>
        <CurrentNavList />
      </Suspense>
      <div className="mt-auto rounded-2xl bg-brand-soft p-4">
        <p className="text-[13px] font-semibold">7-Figure Simulator</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">See what copying your Discord traders would have made.</p>
        <Link href="/portfolio" className="mt-3 inline-block text-xs font-semibold text-up hover:opacity-70">
          Open simulator →
        </Link>
      </div>
    </aside>
  );
}

function CurrentNavList() {
  return <NavList pathname={usePathname()} />;
}

export function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "relative flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[15px] transition-colors",
              active ? "font-semibold text-ink" : "text-ink/80 hover:bg-track/70 hover:text-ink",
            )}
          >
            {active && (
              <motion.span layoutId="nav-active" transition={SPRING} className="absolute inset-0 rounded-xl bg-brand-soft">
                <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand" />
              </motion.span>
            )}
            <Icon className={cn("relative size-[19px]", active ? "text-up" : "text-ink/70")} strokeWidth={1.8} />
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
