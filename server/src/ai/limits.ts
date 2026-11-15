import type { ReplyLength } from "../constants.ts";

/** Model-enforced output budget. Character clipping remains only as a backstop. */
export function maxOutputTokens(length: ReplyLength, cap: number): number {
  const desired = length === "short" ? 256 : length === "long" ? 1024 : 512;
  return Math.max(16, Math.min(desired, cap));
}
