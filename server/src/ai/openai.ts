import { ANSWER_MAX } from "../constants.ts";
import { buildMessages } from "./prompt.ts";
import { AiAborted, AiFailure, type AiProvider, type DraftResult } from "./types.ts";

export function createOpenAiProvider(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): AiProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    provider: "openai",
    model: options.model,
    async generate(input, signal) {
      const timeout = AbortSignal.timeout(options.timeoutMs);
      const combined = AbortSignal.any([signal, timeout]);
      let response: Response;
      try {
        response = await fetchImpl(`${options.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            temperature: 0.4,
            max_tokens: input.maxOutputTokens,
            messages: buildMessages(input),
          }),
          signal: combined,
        });
      } catch {
        if (timeout.aborted) throw new AiFailure();
        if (signal.aborted) throw new AiAborted();
        throw new AiFailure();
      }
      if (!response.ok) throw new AiFailure();
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AiFailure();
      }
      return { text: clip(readContent(payload)), ...readUsage(payload) };
    },
  };
}

function readUsage(payload: unknown): Pick<DraftResult, "inputTokens" | "outputTokens"> {
  if (typeof payload !== "object" || payload === null) return { inputTokens: null, outputTokens: null };
  const usage = (payload as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null) return { inputTokens: null, outputTokens: null };
  return {
    inputTokens: finiteCount((usage as { prompt_tokens?: unknown }).prompt_tokens),
    outputTokens: finiteCount((usage as { completion_tokens?: unknown }).completion_tokens),
  };
}

function finiteCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function readContent(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) throw new AiFailure();
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new AiFailure();
  const first = choices[0];
  if (typeof first !== "object" || first === null) throw new AiFailure();
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) throw new AiFailure();
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") throw new AiFailure();
  const cleaned = content.replaceAll("\u0000", "").trim();
  if (!cleaned) throw new AiFailure();
  return cleaned;
}

function clip(text: string): string {
  const chars = Array.from(text);
  return chars.length > ANSWER_MAX ? chars.slice(0, ANSWER_MAX).join("") : text;
}
