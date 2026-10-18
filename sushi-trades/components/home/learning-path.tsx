"use client";

import { motion } from "motion/react";
import { Check, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "../ui/card";
import { EASE } from "../ui/motion";

export const LESSONS = [
  { title: "Trading Basics", status: "done" },
  { title: "Options Trading", status: "active" },
  { title: "Technical Analysis", status: "locked" },
  { title: "Risk Management", status: "locked" },
] as const;

const XP = 420;
const XP_FOR_LEVEL = 600;

/** "Learning Path": your level, XP bar and the next lessons. */
export function LearningPath({ index = 7 }: { index?: number }) {
  return (
    <Card className="p-4" index={index}>
      <div className="grid items-center gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <CardHeader title="Learning Path" href="/learn" linkLabel="View All" />
          <p className="mt-3 text-base font-bold">Level 12</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-track">
            <motion.div
              className="h-full rounded-full bg-brand"
              initial={{ width: 0 }}
              animate={{ width: `${(XP / XP_FOR_LEVEL) * 100}%` }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
            />
          </div>
          <p className="mt-1.5 text-right text-[11px] text-muted tabular">
            {XP} / {XP_FOR_LEVEL} XP
          </p>
        </div>
        <ol className="grid grid-cols-4">
          {LESSONS.map((lesson, i) => (
            <li key={lesson.title} className="relative flex flex-col items-center text-center">
              {i > 0 && <span className="absolute top-[18px] right-1/2 left-[-50%] -z-0 border-t border-dashed border-brand/50" />}
              <span
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full border-2 bg-surface",
                  lesson.status === "done" && "border-brand text-brand",
                  lesson.status === "active" && "border-ink text-ink",
                  lesson.status === "locked" && "border-line text-faint",
                )}
              >
                {lesson.status === "done" && <Check className="size-4" strokeWidth={3} />}
                {lesson.status === "active" && <Play className="size-3.5 fill-ink" />}
                {lesson.status === "locked" && <Lock className="size-3.5" />}
              </span>
              <span className="mt-2 text-[11px] leading-tight font-medium">{lesson.title}</span>
              <span className="text-[10px] text-muted">
                {lesson.status === "done" ? "Completed" : lesson.status === "active" ? "In Progress" : "Locked"}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
