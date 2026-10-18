"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFollow, usePrefs } from "@/state/prefs";

/** Follow / Following toggle. Followed traders fill the "Following" tab in Community. */
export function FollowButton({ traderId, className }: { traderId: string; className?: string }) {
  const { following } = usePrefs();
  const on = following.includes(traderId);

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFollow(traderId);
      }}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
        on ? "bg-track text-ink" : "bg-ink text-white hover:bg-ink/85",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={on ? "on" : "off"}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {on ? <Check className="size-3.5" strokeWidth={3} /> : <Plus className="size-3.5" strokeWidth={3} />}
        </motion.span>
      </AnimatePresence>
      {on ? "Following" : "Follow"}
    </motion.button>
  );
}
