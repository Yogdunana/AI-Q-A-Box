/**
 * Coarse local hint, not a moderation product. A match keeps the question text
 * off the external model and asks the owner to decide. False negatives remain.
 */
const PATTERNS: RegExp[] = [
  /自杀/,
  /自残/,
  /想死/,
  /suicide/i,
  /kill myself/i,
  /self-harm/i,
  /未成年.{0,12}(色情|裸照|性行为)/,
  /儿童色情/,
  /child\s*(porn|sexual)/i,
  /制作炸弹/,
  /how to make a bomb/i,
];

export function isHighRisk(content: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(content));
}

export function localReviewDraft(): string {
  return [
    "这条问题需要你亲自核对后再决定要不要回复。下面不是结论。",
    "[用你自己的话写；如果不适合回答，可以保持沉默。]",
  ].join("\n\n");
}
