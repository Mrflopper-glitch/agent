"use client";

import { motion } from "motion/react";
import { gaussian, seededRandom } from "@/lib/market/random";
import { EASE } from "../ui/motion";

/**
 * The hero illustration: a rising candlestick chart that builds itself
 * candle by candle, a "+12.8%" callout and a hand-written note.
 */

const WIDTH = 460;
const HEIGHT = 230;
const COUNT = 22;

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
}

// A fixed, hand-tuned uptrend (seeded, so it's identical on every render).
function buildCandles(): Candle[] {
  const random = seededRandom(7);
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < COUNT; i++) {
    const open = price;
    const close = open * (1 + 0.014 + gaussian(random) * 0.035);
    const high = Math.max(open, close) * (1 + random() * 0.02);
    const low = Math.min(open, close) * (1 - random() * 0.02);
    candles.push({ open, close, high, low });
    price = close;
  }
  return candles;
}

const CANDLES = buildCandles();
const LOW = Math.min(...CANDLES.map((c) => c.low));
const HIGH = Math.max(...CANDLES.map((c) => c.high));
const LEFT = 140; // room for the hand-written note
const TOP = 20;
const BOTTOM = HEIGHT - 20;

const x = (i: number) => LEFT + (i / (COUNT - 1)) * (WIDTH - LEFT - 10);
const y = (price: number) => BOTTOM - ((price - LOW) / (HIGH - LOW)) * (BOTTOM - TOP);

/** The candle the callout points at. */
const CALLOUT = 11;

export function HeroCandles({ className }: { className?: string }) {
  const target = CANDLES[CALLOUT];
  const badgeX = x(CALLOUT);
  const badgeY = y(target.high) - 58;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} role="img" aria-label="A rising candlestick chart">
      {CANDLES.map((candle, i) => {
        const up = candle.close >= candle.open;
        const color = up ? "var(--up-line)" : "var(--ink)";
        const top = y(Math.max(candle.open, candle.close));
        const bottom = y(Math.min(candle.open, candle.close));
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.035 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <line x1={x(i)} x2={x(i)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={1.5} />
            <rect x={x(i) - 5} y={top} width={10} height={Math.max(3, bottom - top)} rx={2} fill={color} />
          </motion.g>
        );
      })}

      {/* "+12.8%" callout */}
      <motion.g
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 1.3 }}
      >
        <line x1={badgeX} x2={badgeX} y1={badgeY + 32} y2={y(target.high) - 4} stroke="var(--ink)" strokeWidth={1.2} />
        <rect x={badgeX - 42} y={badgeY} width={84} height={32} rx={8} fill="var(--ink)" />
        <text x={badgeX} y={badgeY + 21.5} textAnchor="middle" fill="var(--brand-bright)" fontSize={17} fontWeight={700}>
          +12.8%
        </text>
      </motion.g>

      {/* Hand-written note with an arrow */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.6 }}
        fontFamily="var(--font-caveat), cursive"
        fontSize={23}
        fill="var(--ink)"
        transform="rotate(-10 60 110)"
      >
        <text x={8} y={96}>Real trades</text>
        <text x={14} y={122}>Real results</text>
      </motion.g>
      <motion.path
        d={`M 118 92 C 150 78, 176 96, ${x(6) - 8} ${y(CANDLES[6].high) - 10}`}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.4}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 1.9 }}
      />
      <motion.path
        d={`M ${x(6) - 16} ${y(CANDLES[6].high) - 14} L ${x(6) - 8} ${y(CANDLES[6].high) - 10} L ${x(6) - 12} ${y(CANDLES[6].high) - 20}`}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6 }}
      />
    </svg>
  );
}
