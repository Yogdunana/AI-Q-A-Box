/**
 * Product decisions still marked TBD in docs/prd.md §16 are gated here so
 * they can be switched without touching components.
 */
export const features = {
  /** Show answers the owner chose to publish on the public box page (PRD §3.2 P1, TBD). */
  publicAnswers: true,
} as const;
