"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { appear } from "./motion";

/** The title block at the top of each page. */
export function PageHeader({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <motion.div {...appear()} className="mb-5 flex flex-wrap items-end justify-between gap-4 pt-1">
      <div>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </motion.div>
  );
}
