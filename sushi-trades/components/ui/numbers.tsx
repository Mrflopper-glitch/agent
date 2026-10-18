"use client";

import { motion, useAnimate, useSpring, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A number that glides to its new value instead of jumping. */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 140, damping: 24, mass: 0.6 });
  const text = useTransform(spring, format);
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span className={cn("tabular", className)}>{text}</motion.span>;
}

/** A price that briefly glows green or red whenever it ticks. */
export function LivePrice({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const previous = useRef(value);

  useEffect(() => {
    if (value === previous.current || !scope.current) return;
    const glow = value > previous.current ? "rgba(7, 154, 70, 0.14)" : "rgba(229, 72, 77, 0.14)";
    previous.current = value;
    animate(scope.current, { backgroundColor: [glow, "rgba(0, 0, 0, 0)"] }, { duration: 0.9 });
  }, [value, animate, scope]);

  return (
    <span ref={scope} className={cn("tabular -mx-1 rounded-md px-1", className)}>
      {format(value)}
    </span>
  );
}

/** "+2.84%" in green or "-0.48%" in red. */
export function Change({
  value,
  className,
  digits = 2,
  pill = false,
}: {
  value: number;
  className?: string;
  digits?: number;
  pill?: boolean;
}) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "tabular font-semibold",
        up ? "text-up" : "text-down",
        pill && (up ? "rounded-full bg-brand-soft px-2 py-0.5" : "rounded-full bg-down-soft px-2 py-0.5"),
        className,
      )}
    >
      {percent(value, digits)}
    </span>
  );
}
