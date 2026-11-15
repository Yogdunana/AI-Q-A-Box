import type { ReplyStyle } from "../constants.ts";

export interface DraftInput {
  question: string;
  style: ReplyStyle;
  maxOutputTokens: number;
}

export interface DraftResult {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export class AiFailure extends Error {
  constructor() {
    super("ai request failed");
    this.name = "AiFailure";
  }
}

export class AiAborted extends Error {
  constructor() {
    super("ai request aborted");
    this.name = "AiAborted";
  }
}

export interface AiProvider {
  readonly provider: string;
  readonly model: string;
  generate(input: DraftInput, signal: AbortSignal): Promise<DraftResult>;
}
