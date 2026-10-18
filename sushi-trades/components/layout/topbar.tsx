"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "../brand/logo";
import { EASE } from "../ui/motion";
import { isActive, TOP_LINKS } from "./nav";
import { Notifications } from "./notifications";
import { Search } from "./search";
import { NavList } from "./sidebar";

/** The bar across the top: search, shortcuts, notifications and (on phones) the menu button. */
export function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center gap-3 bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        onClick={() => setMenuOpen(true)}
        className="-ml-1 flex size-10 items-center justify-center rounded-xl hover:bg-track lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <Link href="/" className="text-ink lg:hidden" aria-label="Sushi Trades home">
        <Logo className="h-6" />
      </Link>

      <Search className="ml-auto hidden w-full max-w-[500px] sm:block lg:ml-0" />

      <Suspense fallback={<nav className="ml-auto hidden xl:block" />}>
        <TopLinks />
      </Suspense>

      <div className="ml-auto flex items-center gap-2 sm:ml-2 xl:ml-6">
        <Notifications />
        <Link
          href="/portfolio"
          aria-label="Your portfolio"
          className="size-10 rounded-full bg-[radial-gradient(circle_at_30%_25%,#4b5563,#0b0c0e_70%)] ring-2 ring-surface transition-transform hover:scale-105"
        />
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink/30 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-surface px-4 py-5 shadow-lift lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <div className="mb-6 flex items-center justify-between px-3">
                <Logo className="h-7" />
                <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 hover:bg-track">
                  <X className="size-5" />
                </button>
              </div>
              <Search className="mb-4 sm:hidden" />
              <MobileNav onNavigate={() => setMenuOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function TopLinks() {
  const pathname = usePathname();
  return (
    <nav className="ml-auto hidden items-center gap-7 xl:flex">
      {TOP_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "text-[15px] font-medium transition-colors",
            isActive(pathname, href) ? "text-ink" : "text-ink/75 hover:text-ink",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}
