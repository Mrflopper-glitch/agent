/**
 * Shared animation presets, so every part of the app moves the same way:
 * quick, soft, and never bouncy enough to feel playful.
 */

/** The easing curve used everywhere: fast start, gentle landing. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade in while sliding up a little. `index` staggers items in a list. */
export function appear(index = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: EASE, delay: Math.min(index, 12) * 0.05 },
  };
}

/** For items entering and leaving a live list (feeds, toasts). */
export const listItem = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.35, ease: EASE },
};

/** A soft spring for things that follow the pointer or change size. */
export const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
