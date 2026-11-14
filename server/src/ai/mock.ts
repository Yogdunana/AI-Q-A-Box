import type { ReplyStyle } from "../constants.ts";
import { AiAborted, type AiProvider, type DraftInput } from "./types.ts";

/** Offline stand-in. Brackets mark what the owner still has to write; notes are not copied in. */
export function createMockProvider(): AiProvider {
  return {
    provider: "mock",
    model: "mock-draft-v1",
    generate(input, signal) {
      if (signal.aborted) throw new AiAborted();
      return Promise.resolve(composeDraft(input));
    },
  };
}

function composeDraft(input: DraftInput): string {
  const english = input.style.language === "en" || (input.style.language === "auto" && !/[\u4e00-\u9fff]/.test(input.question));
  return english ? englishDraft(input.question, input.style) : chineseDraft(input.question, input.style);
}

function chineseDraft(question: string, style: ReplyStyle): string {
  const topic = truncate(question, 24);
  const opening: Record<ReplyStyle["tone"], string> = {
    warm: "谢谢你认真地问出这个问题。",
    direct: "直接说我的看法。",
    playful: "好问题，我差点被问住了。",
    professional: "感谢提问，我分几点说明。",
  };
  const closing: Record<ReplyStyle["tone"], string> = {
    warm: "如果你愿意多讲讲自己的情况，我可以说得更具体一些。",
    direct: "以上，希望有帮助。",
    playful: "如果还有后续，欢迎继续来问。",
    professional: "如需进一步讨论，欢迎补充背景信息。",
  };
  const parts = [opening[style.tone], `关于「${topic}」，我的想法是：[在这里写下你的核心观点]。`];
  if (style.length === "long") {
    parts.push("具体来说，可以从两方面看：\n1. [第一点：你的经验或判断]\n2. [第二点：需要注意的地方]");
  }
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
  const parts = [opening[style.tone], `On "${topic}", my view is: [your main point here].`];
  if (style.length === "long") {
    parts.push("Specifically:\n1. [First point: your experience or judgement]\n2. [Second point: what to watch out for]");
  }
  if (style.length !== "short") parts.push("Happy to go deeper if you share a bit more context.");
  return parts.join("\n\n");
}

function truncate(text: string, max: number): string {
  const chars = Array.from(text.replaceAll(/\s+/g, " ").trim());
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : chars.join("");
}
