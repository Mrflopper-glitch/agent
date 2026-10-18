"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { appear } from "./motion";

/** The white rounded box everything sits in. `index` staggers its entrance. */
export function Card({ className, index = 0, children }: { className?: string; index?: number; children: ReactNode }) {
  return (
    <motion.section {...appear(index)} className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}>
      {children}
    </motion.section>
  );
}

/** A card's title row, with an optional "See All" link or custom controls. */
export function CardHeader({
  title,
  href,
  linkLabel = "See All",
  children,
  className,
}: {
  title: ReactNode;
  href?: string;
  linkLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      {children}
      {href && (
        <Link href={href} className="shrink-0 text-[13px] font-semibold text-up transition-opacity hover:opacity-70">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
