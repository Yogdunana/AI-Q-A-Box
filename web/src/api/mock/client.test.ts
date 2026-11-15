import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../errors";
import { DEFAULT_REPLY_STYLE } from "../defaults";
import type { ApiClient } from "../types";
import { createMockClient, FAIL_AI_KEY } from "./client";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./seed";
import { newViewToken } from "../../lib/view-token";

let api: ApiClient;
let now = Date.parse("2026-11-15T08:00:00Z");

const submit = (content = "你最近在忙什么？", extra: Partial<Parameters<ApiClient["submitQuestion"]>[1]> = {}) =>
  api.submitQuestion("lin", {
    content,
    is_anonymous: true,
    idempotency_key: crypto.randomUUID(),
    view_token: newViewToken(),
    ...extra,
  });

async function expectCode(promise: Promise<unknown>, code: ApiError["code"]) {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await promise.catch((error: ApiError) => expect(error.code).toBe(code));
}

beforeEach(() => {
  window.localStorage.clear();
  now = Date.parse("2026-11-15T08:00:00Z");
  api = createMockClient({ storage: window.localStorage, latency: false, now: () => now });
});

describe("public submission", () => {
  it("accepts an anonymous question and shows it in the owner's inbox", async () => {
    const { id } = await submit("一个新的问题");
    await api.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const list = await api.listQuestions({ status: ["submitted"] });
    expect(list.items[0]).toMatchObject({ id, content: "一个新的问题", is_anonymous: true, asker_display_name: null });
  });

  it("deduplicates retries that reuse the idempotency key and the same view token", async () => {
    const view_token = newViewToken();
    const first = await submit("重复提交", { idempotency_key: "same", view_token });
    const second = await submit("重复提交", { idempotency_key: "same", view_token });
    expect(second.id).toBe(first.id);
    await expectCode(submit("重复提交", { idempotency_key: "same", view_token: newViewToken() }), "conflict");
    const reply = await api.readReply(view_token);
    expect(reply.state).toBe("pending");
    expect(reply.question?.content).toBe("重复提交");
  });

  it("rate limits bursts from the same browser", async () => {
    for (let i = 0; i < 5; i++) await submit(`问题 ${i}`);
    await expectCode(submit("第六个"), "rate_limited");
    now += 61_000;
    await expect(submit("一分钟以后")).resolves.toHaveProperty("id");
  });

  it("requires a nickname when the owner disables anonymous questions", async () => {
    const session = await api.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    await api.updateBox(session.box!.id, { anonymous_mode: "disabled" });
    await expectCode(submit("没有称呼", { is_anonymous: true }), "validation");
    await expect(submit("留了称呼", { is_anonymous: false, asker_display_name: "阿远" })).resolves.toHaveProperty("id");
  });

  it("refuses questions while the box is paused", async () => {
    const session = await api.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    await api.updateBox(session.box!.id, { status: "paused" });
    expect((await api.getPublicBox("lin")).accepting).toBe(false);
    await expectCode(submit(), "forbidden");
  });

  it("returns not_found for unknown or reserved slugs", async () => {
    await expectCode(api.getPublicBox("nobody"), "not_found");
    await expectCode(api.getPublicBox("app"), "not_found");
  });
});

describe("owner isolation", () => {
  it("keeps one owner's questions invisible to another", async () => {
    await api.register({ email: "other@example.com", password: "password-1", display_name: "另一个人" });
    await api.createBox({
      slug: "other",
      title: "问我",
      description: "",
      anonymous_mode: "allowed",
      default_reply_visibility: "private",
      status: "active",
      reply_style: DEFAULT_REPLY_STYLE,
    });
    expect((await api.listQuestions({})).items).toHaveLength(0);
    await expectCode(api.getQuestion("q_demo_1"), "not_found");
    await expectCode(api.updateQuestionStatus("q_demo_1", "archived"), "not_found");
  });

  it("rejects slugs that are already taken", async () => {
    await api.register({ email: "x@example.com", password: "password-1", display_name: "X" });
    await expectCode(
      api.createBox({
        slug: "lin",
        title: "t",
        description: "",
        anonymous_mode: "allowed",
        default_reply_visibility: "private",
        status: "active",
        reply_style: DEFAULT_REPLY_STYLE,
      }),
      "conflict",
    );
  });

  it("requires a session for owner endpoints", async () => {
    await expectCode(api.listQuestions({}), "unauthorized");
  });
});

describe("reply workflow", () => {
  beforeEach(async () => {
    await api.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  });

  it("marks a question as drafted after an AI draft and never publishes on its own", async () => {
    const generation = await api.generateDraft("q_demo_1");
    expect(generation.output).toContain("[");
    const detail = await api.getQuestion("q_demo_1");
    expect(detail.question.status).toBe("drafted");
    expect(detail.answer).toBeNull();
    expect(await api.getPublicAnswers("lin")).toHaveLength(0);
    expect(await api.getCapabilities()).toMatchObject({ public_replies_enabled: false, asker_access: "link" });
  });

  it("surfaces model failures without touching the question", async () => {
    window.localStorage.setItem(FAIL_AI_KEY, "1");
    await expectCode(api.generateDraft("q_demo_1"), "server");
    expect((await api.getQuestion("q_demo_1")).question.status).toBe("submitted");
  });

  it("confirms a private snapshot and refuses to publish without asker consent", async () => {
    const saved = await api.saveAnswer("q_demo_2", { content: "先打磨三个完整案例。", visibility: "private", source: "human" });
    expect((await api.getQuestion("q_demo_2")).question.status).toBe("drafted");
    await expectCode(api.publishAnswer(saved.id, "public"), "forbidden");

    const confirmed = await api.publishAnswer(saved.id, "private");
    expect((await api.getQuestion("q_demo_2")).question.status).toBe("answered_private");
    expect(confirmed.confirmed_content).toBe("先打磨三个完整案例。");
    await api.updateAnswer(saved.id, { content: "还没再次确认" });
    expect((await api.getQuestion("q_demo_2")).answer?.confirmed_content).toBe("先打磨三个完整案例。");
  });

  it("keeps private replies off the public page", async () => {
    const saved = await api.saveAnswer("q_demo_2", { content: "私下聊。", visibility: "private", source: "human" });
    await api.publishAnswer(saved.id, "private");
    expect((await api.getQuestion("q_demo_2")).question.status).toBe("answered_private");
    expect((await api.getPublicAnswers("lin")).some((a) => a.answer === "私下聊。")).toBe(false);
  });

  it("soft-deletes questions out of every list", async () => {
    await api.deleteQuestion("q_demo_3");
    expect((await api.listQuestions({})).items.some((q) => q.id === "q_demo_3")).toBe(false);
    await expectCode(api.getQuestion("q_demo_3"), "not_found");
  });
});
