"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { tradeEvents } from "@/lib/feed";
import { moneyCompact, moneyWhole, timeAgoLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useClock, useData } from "@/state/app-state";
import { useSimulation } from "@/state/derived";
import { HeroCandles } from "../charts/candles";
import { Avatar } from "../ui/avatar";
import { ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { EASE } from "../ui/motion";
import { EventSentence } from "../trades/event-sentence";

const GOAL = 1_000_000;
const ROTATE_MS = 7000;

interface Slide {
  title: ReactNode;
  subtitle: string;
  cta: { label: string; href: string };
  visual: () => ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: (
      <>
        Trade Smarter
        <br />
        with 7 Figure
        <br />
        Professionals
      </>
    ),
    subtitle: "Real strategies. Real portfolios. Real insights.",
    cta: { label: "Explore", href: "/traders" },
    visual: () => <HeroCandles className="h-full w-full" />,
  },
  {
    title: (
      <>
        Every Discord call.
        <br />
        Tracked live.
      </>
    ),
    subtitle: "Entries, exits and trims, picked up the second they're posted.",
    cta: { label: "Live trades", href: "/trades" },
    visual: () => <LatestCalls />,
  },
  {
    title: (
      <>
        Your path to
        <br />
        $1,000,000
      </>
    ),
    subtitle: "Copy any trader, with any budget, and watch it compound.",
    cta: { label: "Open simulator", href: "/portfolio" },
    visual: () => <GoalRing />,
  },
];

/** The big banner at the top of Home. Rotates through three slides; hovering pauses it. */
export function Hero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[index];

  return (
    <Card className="relative overflow-hidden">
      <div
        className="grid min-h-[250px] gap-2 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:p-9"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="flex flex-col justify-center"
          >
            <h1 className="text-[34px] leading-[1.04] font-extrabold tracking-[-0.03em] sm:text-[42px]">{slide.title}</h1>
            <p className="mt-3 text-[15px] text-muted sm:text-base">{slide.subtitle}</p>
            <ButtonLink href={slide.cta.href} size="lg" className="mt-6 w-fit">
              {slide.cta.label} <ArrowRight className="size-[18px]" strokeWidth={2.4} />
            </ButtonLink>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="hidden h-[210px] items-center justify-center md:flex"
          >
            {slide.visual()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Show slide ${i + 1}`}
            className={cn("h-2 rounded-full transition-all duration-500", i === index ? "w-6 bg-ink" : "w-2 bg-line hover:bg-faint")}
          />
        ))}
      </div>
    </Card>
  );
}

/** Slide 2: the three most recent calls, sliding in like Discord messages. */
function LatestCalls() {
  const { trades, tradersById } = useData();
  const { now } = useClock();
  const latest = useMemo(() => tradeEvents(trades).slice(0, 3), [trades]);

  return (
    <div className="w-full max-w-[400px] space-y-2.5">
      {latest.map((event, i) => (
        <motion.div
          key={event.key}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.12 }}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-card"
        >
          <Avatar trader={tradersById.get(event.trade.traderId)} size={34} />
          <div className="min-w-0 flex-1 text-[13px]">
            <EventSentence event={event} trader={tradersById.get(event.trade.traderId)} />
          </div>
          <span className="shrink-0 text-[11px] text-faint">{timeAgoLong(event.at, now)}</span>
        </motion.div>
      ))}
    </div>
  );
}

/** Slide 3: a ring filling up toward $1M with your simulator balance. */
function GoalRing() {
  const { snapshot } = useSimulation();
  const progress = Math.min(1, snapshot.equity / GOAL);
  const radius = 78;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative flex size-[200px] items-center justify-center">
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--track)" strokeWidth="14" />
        <motion.circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-extrabold tracking-tight tabular">{moneyWhole(snapshot.equity)}</p>
        <p className="mt-1 text-xs text-muted">of {moneyCompact(GOAL)} goal</p>
        <p className="mt-0.5 text-xs font-semibold text-up">{Math.round(progress * 100)}% there</p>
      </div>
    </div>
  );
}
