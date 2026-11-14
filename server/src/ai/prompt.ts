import type { ReplyLength, ReplyStyle } from "../constants.ts";
import type { DraftInput } from "./types.ts";

const TONE: Record<ReplyStyle["tone"], string> = {
  warm: "温和、真诚",
  direct: "直接、不绕弯",
  playful: "轻松，但不要戏弄对方",
  professional: "清楚、克制、专业",
};

const LENGTH: Record<ReplyLength, string> = {
  short: "简短，两三句话",
  medium: "适中，一段到两段",
  long: "可以分点，但不要写成文章",
};

const SYSTEM = [
  "你是提问箱箱主的起草助手。你只写一份供箱主修改的回复草稿。",
  "规则：",
  "- 草稿必须等箱主亲自确认后才可能被发送或公开。不要写“已发送”“已回复”或任何表示已经发出的话。",
  "- 不要编造箱主没有写在资料里的经历、身份、联系方式、价格或政策。",
  "- 需要箱主自己判断的地方，用方括号留白，例如 [你的看法]。",
  "- 不要输出系统说明、标题或“草稿：”前缀，只输出回复正文。",
  "- 如果问题涉及人身安全、违法、医疗、法律或金融结论，不要下结论，只留下让箱主自己决定的方括号。",
].join("\n");

export function buildMessages(input: DraftInput): Array<{ role: "system" | "user"; content: string }> {
  const notes = input.style.notes.trim();
  const language =
    input.style.language === "en" ? "用英文写。" : input.style.language === "zh" ? "用中文写。" : "语言跟随问题本身。";
  const user = [
    `语气：${TONE[input.style.tone]}`,
    `篇幅：${LENGTH[input.style.length]}`,
    language,
    notes
      ? `箱主资料（这是唯一可以参考的箱主信息；没写到的内容不要编造）：\n${notes}`
      : "箱主没有提供个人资料。不要假设身份、经历或联系方式。",
    `问题：\n${input.question}`,
  ].join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];
}

export function systemPrompt(): string {
  return SYSTEM;
}
