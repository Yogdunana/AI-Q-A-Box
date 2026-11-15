import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockProvider, createOpenAiProvider, buildMessages, systemPrompt } from "../src/ai/index.ts";
import { AiFailure } from "../src/ai/types.ts";

const style = { tone: "warm" as const, length: "medium" as const, language: "zh" as const, notes: "我是独立设计师" };

describe("ai providers", () => {
  it("builds a server-side prompt from the current question and saved style only", () => {
    const messages = buildMessages({ question: "怎么开始做一个产品？", style });
    const text = messages.map((message) => message.content).join("\n");
    assert.match(systemPrompt(), /不要编造/);
    assert.match(text, /怎么开始做一个产品/);
    assert.match(text, /我是独立设计师/);
    assert.equal(text.includes("other-owner@example.com"), false);
    assert.equal(messages[0]?.role, "system");
  });

  it("keeps private notes out of the offline draft text", async () => {
    const output = await createMockProvider().generate(
      { question: "你最近在忙什么？", style: { ...style, notes: "NOTES_SECRET_8848" } },
      new AbortController().signal,
    );
    assert.match(output, /\[/);
    assert.equal(output.includes("NOTES_SECRET_8848"), false);
  });

  it("calls an OpenAI-compatible endpoint without leaking the key", async () => {
    const seen: { authorization?: string; body?: string } = {};
    const provider = createOpenAiProvider({
      apiKey: "test-key-should-not-leak",
      baseUrl: "https://models.example/v1",
      model: "draft-model",
      timeoutMs: 1000,
      fetchImpl: (async (_url, init) => {
        seen.authorization = new Headers(init?.headers).get("authorization") ?? "";
        seen.body = String(init?.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: "模型草稿 [你的看法]" } }] }), { status: 200 });
      }) as typeof fetch,
    });
    const output = await provider.generate({ question: "你好", style }, new AbortController().signal);
    assert.equal(output, "模型草稿 [你的看法]");
    assert.equal(seen.authorization, "Bearer test-key-should-not-leak");
    assert.match(String(seen.body), /你好/);
    assert.equal(String(seen.body).includes("test-key-should-not-leak"), false);

    const failing = createOpenAiProvider({
      apiKey: "test-key-should-not-leak",
      baseUrl: "https://models.example/v1",
      model: "draft-model",
      timeoutMs: 1000,
      fetchImpl: (async () => new Response("test-key-should-not-leak", { status: 500 })) as typeof fetch,
    });
    await assert.rejects(() => failing.generate({ question: "你好", style }, new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof AiFailure);
      assert.equal(error.message.includes("test-key-should-not-leak"), false);
      return true;
    });
  });
});
