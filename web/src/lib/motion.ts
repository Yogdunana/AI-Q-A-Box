import type { Transition, Variants } from "motion/react";

/** Keep in sync with the --ease-* and --dur-* tokens in styles/tokens.css. */
export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.55, 0, 1, 0.45],
} as const;

export const duration = {
  instant: 0.1,
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
} as const;

export const spring = {
  /** Indicators, toggles: quick and settled, no visible overshoot. */
  snappy: { type: "spring", stiffness: 520, damping: 42, mass: 0.9 },
  /** Panels and sheets. */
  gentle: { type: "spring", stiffness: 340, damping: 34, mass: 1 },
} satisfies Record<string, Transition>;

export const page: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: ease.out },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.instant, ease: ease.in },
  },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const stagger = (step = 0.04, delay = 0): Variants => ({
  animate: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const popover: Variants = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: duration.fast, ease: ease.out } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: duration.instant, ease: ease.in } },
};
