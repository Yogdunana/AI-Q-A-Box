import type { Config } from "../config.ts";
import { createMockProvider } from "./mock.ts";
import { createOpenAiProvider } from "./openai.ts";
import type { AiProvider } from "./types.ts";

export function createAiProvider(config: Config): AiProvider {
  if (config.aiProvider === "openai") {
    if (!config.aiApiKey) throw new Error("AI_API_KEY is required when AI_PROVIDER=openai");
    return createOpenAiProvider({
      apiKey: config.aiApiKey,
      baseUrl: config.aiBaseUrl,
      model: config.aiModel,
      timeoutMs: config.aiTimeoutMs,
    });
  }
  return createMockProvider();
}

export { AiAborted, AiFailure, type AiProvider, type DraftInput } from "./types.ts";
export { createMockProvider } from "./mock.ts";
export { createOpenAiProvider } from "./openai.ts";
export { buildMessages, systemPrompt } from "./prompt.ts";
