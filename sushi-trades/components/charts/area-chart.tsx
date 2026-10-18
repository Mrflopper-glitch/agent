"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type PointerEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { EASE } from "../ui/motion";
import { chartPaths } from "./paths";

export interface ChartPoint {
  /** Usually a timestamp; passed to formatLabel. */
  x: number;
  y: number;
}

/**
 * The big interactive chart: gradient area, hover crosshair with a tooltip,
 * optional dashed reference lines (like "Start $100K") and light axis labels.
 * `revealKey` replays the draw-in animation when it changes (e.g. new timeframe).
 */
export function AreaChart({
  data,
  height = 220,
  formatValue,
  formatLabel,
  markers = [],
  color,
  revealKey,
  showAxis = true,
  className,
}: {
  data: ChartPoint[];
  height?: number;
  formatValue: (value: number) => string;
  formatLabel: (x: number) => string;
  markers?: { value: number; label: string }[];
  color?: string;
  revealKey?: string;
  showAxis?: boolean;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [hover, setHover] = useState<number | null>(null);

  const axisRight = showAxis ? 56 : 0;
  const axisBottom = showAxis ? 22 : 0;
  const plotWidth = Math.max(0, width - axisRight);
  const plotHeight = height - axisBottom;

  const values = data.map((d) => d.y);
  let min = Math.min(...values);
  let max = Math.max(...values);
  // Show a marker only if it's near the data, so a far-away line doesn't flatten the chart.
  const visibleMarkers = markers.filter((m) => m.value >= min - (max - min) * 0.5 && m.value <= max + (max - min) * 0.5);
  for (const m of visibleMarkers) {
    min = Math.min(min, m.value);
    max = Math.max(max, m.value);
  }
  const padding = (max - min) * 0.08 || max * 0.01 || 1;
  const domain: [number, number] = [min - padding, max + padding];
  const toY = (value: number) => (1 - (value - domain[0]) / (domain[1] - domain[0])) * plotHeight;

  const up = values.length < 2 || values[values.length - 1] >= values[0];
  const stroke = color ?? (up ? "var(--up-line)" : "var(--down)");
  const { line, area, points } = chartPaths(values, plotWidth, plotHeight, 0, domain);

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, plotWidth)));
    setHover(Math.round(ratio * (data.length - 1)));
  }

  const hovered = hover !== null ? points[hover] : null;
  const yTicks = [0.15, 0.5, 0.85].map((t) => domain[1] - t * (domain[1] - domain[0]));
  const xTicks = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [];

  return (
    <div ref={box} className={cn("relative w-full select-none", className)} style={{ height }}>
      {width > 0 && data.length > 1 && (
        <svg width={width} height={height} className="overflow-visible" onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={`fill${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.24} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
            <clipPath id={`clip${id}`}>
              <motion.rect
                key={revealKey}
                x={-4}
                y={-8}
                height={plotHeight + 16}
                initial={{ width: 0 }}
                animate={{ width: plotWidth + 8 }}
                transition={{ duration: 1.2, ease: EASE }}
              />
            </clipPath>
          </defs>

          {showAxis &&
            yTicks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={plotWidth} y1={toY(tick)} y2={toY(tick)} stroke="var(--line)" strokeDasharray="2 4" />
                <text x={plotWidth + 8} y={toY(tick) + 4} className="fill-faint text-[11px] tabular">
                  {formatValue(tick)}
                </text>
              </g>
            ))}

          {showAxis &&
            xTicks.map((index, i) => (
              <text
                key={index}
                x={points[index].x}
                y={height - 4}
                textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
                className="fill-faint text-[11px]"
              >
                {formatLabel(data[index].x)}
              </text>
            ))}

          {visibleMarkers.map((marker) => (
            <g key={marker.label}>
              <line x1={0} x2={plotWidth} y1={toY(marker.value)} y2={toY(marker.value)} stroke="var(--faint)" strokeDasharray="4 4" />
              <text x={4} y={toY(marker.value) - 6} className="fill-muted text-[11px] font-medium">
                {marker.label}
              </text>
            </g>
          ))}

          <g clipPath={`url(#clip${id})`}>
            <path d={area} fill={`url(#fill${id})`} />
            <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>

          {/* The live dot at the end of the line. */}
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3.5} fill={stroke} />
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={8} fill={stroke} opacity={0.15} className="live-dot" />

          {hovered && (
            <g>
              <line x1={hovered.x} x2={hovered.x} y1={0} y2={plotHeight} stroke="var(--ink)" strokeOpacity={0.15} />
              <circle cx={hovered.x} cy={hovered.y} r={4.5} fill="white" stroke={stroke} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      <AnimatePresence>
        {hovered && hover !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute top-0 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lift"
            style={{ left: Math.min(Math.max(hovered.x - 60, 0), Math.max(0, plotWidth - 120)), width: 120 }}
          >
            <div className="tabular font-semibold">{formatValue(data[hover].y)}</div>
            <div className="text-white/60">{formatLabel(data[hover].x)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Measures an element's width and keeps it updated as the window resizes. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
