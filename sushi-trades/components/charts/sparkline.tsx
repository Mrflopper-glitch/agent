"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { EASE } from "../ui/motion";
import { chartPaths } from "./paths";

/** A tiny trend line. Green if it ended higher than it started, red if lower. It draws itself in on first show. */
export function Sparkline({
  values,
  className,
  color,
  fill = true,
}: {
  values: number[];
  className?: string;
  color?: string;
  fill?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (values.length < 2) return <div className={className} />;

  const up = values[values.length - 1] >= values[0];
  const stroke = color ?? (up ? "var(--up-line)" : "var(--down)");
  const { line, area } = chartPaths(values, 100, 40, 3);

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`fill${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`clip${id}`}>
          <motion.rect x="-2" y="-10" height="60" initial={{ width: 0 }} animate={{ width: 104 }} transition={{ duration: 1.1, ease: EASE }} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip${id})`}>
        {fill && <path d={area} fill={`url(#fill${id})`} />}
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </g>
    </svg>
  );
}
