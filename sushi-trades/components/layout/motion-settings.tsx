"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Turns animations down for people who've asked their device for reduced motion. */
export function MotionSettings({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
