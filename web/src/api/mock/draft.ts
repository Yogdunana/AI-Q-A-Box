import type { ReplyStyle } from "../types";
import { truncate } from "../../lib/format";

/**
 * Stand-in for the server-side model call. It deliberately leaves bracketed
 * gaps instead of inventing facts about the owner (docs/prd.md §8.2).
 */
export function composeMockDraft(question: string, style: ReplyStyle): string {
  const english =
    style.language === "en" || (style.language === "auto" && !/[\u4e00-\u9fff]/.test(question));
  return english ? englishDraft(question, style) : chineseDraft(question, style);
}

function chineseDraft(question: string, style: ReplyStyle): string {
  const topic = truncate(question, 24);
  const opening: Record<ReplyStyle["tone"], string> = {
    warm: "谢谢你认真地问出这个问题。",
    direct: "直接说我的看法。",
    playful: "好问题，我差点被问住了。",
    professional: "感谢提问，我分几点说明。",
  };
  const core = `关于「${topic}」，我的想法是：[在这里写下你的核心观点]。`;
  const detail =
    "具体来说，可以从两方面看：\n1. [第一点：你的经验或判断]\n2. [第二点：需要注意的地方]";
  const closing: Record<ReplyStyle["tone"], string> = {
    warm: "如果你愿意多讲讲自己的情况，我可以说得更具体一些。",
    direct: "以上，希望有帮助。",
    playful: "如果还有后续，欢迎继续来问。",
    professional: "如需进一步讨论，欢迎补充背景信息。",
  };

  const parts = [opening[style.tone], core];
  if (style.length === "long") parts.push(detail);
  if (style.length !== "short") parts.push(closing[style.tone]);
  return parts.join("\n\n");
}

function englishDraft(question: string, style: ReplyStyle): string {
  const topic = truncate(question, 48);
  const opening: Record<ReplyStyle["tone"], string> = {
    warm: "Thank you for asking this so thoughtfully.",
    direct: "Here's my honest take.",
    playful: "Great question — you almost stumped me.",
    professional: "Thanks for the question. A few points:",
  };
  const core = `On "${topic}", my view is: [your main point here].`;
  const detail = "Specifically:\n1. [First point: your experience or judgement]\n2. [Second point: what to watch out for]";
  const closing = "Happy to go deeper if you share a bit more context.";

  const parts = [opening[style.tone], core];
  if (style.length === "long") parts.push(detail);
  if (style.length !== "short") parts.push(closing);
  return parts.join("\n\n");
}
