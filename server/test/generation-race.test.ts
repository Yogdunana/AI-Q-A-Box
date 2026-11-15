import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import http from "node:http";
import { afterEach, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { AiAborted, type AiProvider, type DraftResult } from "../src/ai/index.ts";
import { boxBody, closeTestApp, createTestApp, sessionCookie, type TestApp } from "./helpers.ts";

const draft: DraftResult = { text: "迟到的草稿正文", inputTokens: 8, outputTokens: 5 };

describe("generation races", () => {
  const apps: TestApp[] = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const ctx = apps.pop();
      if (ctx) await closeTestApp(ctx);
    }
  });

  it("drops a draft that finishes after the question is deleted or archived", async () => {
    const deleted = await finishAfter(async (ctx, owner, questionId) => {
      const response = await ctx.app.inject({
        method: "DELETE",
        url: `/api/me/questions/${questionId}`,
        headers: { cookie: owner },
      });
      assert.equal(response.statusCode, 204);
    });
    assert.equal(deleted.statusCode, 404);
    assert.equal(completedOutputs(deleted.ctx, deleted.questionId).includes(draft.text), false);
    const row = deleted.ctx.db.prepare("SELECT status, deleted_at FROM questions WHERE id = ?").get(deleted.questionId) as {
      status: string;
      deleted_at: string | null;
    };
    assert.equal(row.status, "deleted");
    assert.equal(row.deleted_at === null, false);
    await closeTestApp(deleted.ctx);

    const archived = await finishAfter(async (ctx, owner, questionId) => {
      const response = await ctx.app.inject({
        method: "PATCH",
        url: `/api/me/questions/${questionId}`,
        headers: { cookie: owner },
        payload: { status: "archived" },
      });
      assert.equal(response.statusCode, 200);
    });
    assert.equal(archived.statusCode, 409);
    assert.equal(completedOutputs(archived.ctx, archived.questionId).includes(draft.text), false);
    const status = archived.ctx.db.prepare("SELECT status FROM questions WHERE id = ?").get(archived.questionId) as {
      status: string;
    };
    assert.equal(status.status, "archived");
    await closeTestApp(archived.ctx);
  });

  it("rejects a second generation for the same question while one is running", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const ai: AiProvider = {
      provider: "test",
      model: "test-model",
      generate() {
        calls += 1;
        return gate.then(() => draft);
      },
    };
    const ctx = await createTestApp({ ai });
    apps.push(ctx);
    const owner = await register(ctx);
    const questionId = await ask(ctx, "同时点两次");
    const first = ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${questionId}/ai-drafts`,
      headers: { cookie: owner },
      payload: {},
    });
    await waitFor(() => calls === 1);
    const second = await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${questionId}/ai-drafts`,
      headers: { cookie: owner },
      payload: {},
    });
    assert.equal(second.statusCode, 409);
    release();
    const finished = await first;
    assert.equal(finished.statusCode, 200);
    assert.equal(finished.json().output, draft.text);
    assert.equal(calls, 1);
  });

  it("does not treat a finished response as a client disconnect", async () => {
    let aborted = false;
    const ai: AiProvider = {
      provider: "test",
      model: "test-model",
      generate(_input, signal) {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return Promise.resolve(draft);
      },
    };
    const ctx = await createTestApp({ ai });
    apps.push(ctx);
    const owner = await register(ctx);
    const questionId = await ask(ctx, "正常完成");
    const response = await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${questionId}/ai-drafts`,
      headers: { cookie: owner },
      payload: {},
    });
    assert.equal(response.statusCode, 200);
    assert.equal(aborted, false);
  });

  it("cancels the upstream request when the client connection closes", async () => {
    let aborted = false;
    let entered = false;
    const ai: AiProvider = {
      provider: "test",
      model: "test-model",
      generate(_input, signal) {
        entered = true;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new AiAborted());
          });
        });
      },
    };
    const ctx = await createTestApp({ ai });
    apps.push(ctx);
    const owner = await register(ctx);
    const questionId = await ask(ctx, "中途断开");
    await ctx.app.listen({ host: "127.0.0.1", port: 0 });
    const address = ctx.app.server.address() as AddressInfo;
    const req = http.request({
      hostname: "127.0.0.1",
      port: address.port,
      path: `/api/me/questions/${questionId}/ai-drafts`,
      method: "POST",
      headers: {
        cookie: owner,
        "content-type": "application/json",
        connection: "close",
      },
    });
    req.on("error", () => undefined);
    req.end("{}");
    await waitFor(() => entered);
    req.destroy();
    await waitFor(() => aborted);
    const outputs = completedOutputs(ctx, questionId);
    assert.deepEqual(outputs, []);
    const failure = ctx.db.prepare("SELECT error_code, output FROM ai_generations WHERE question_id = ?").get(questionId) as
      | { error_code: string; output: string }
      | undefined;
    assert.equal(failure?.error_code, "aborted");
    assert.equal(failure?.output, "");
  });
});

async function finishAfter(
  change: (ctx: TestApp, owner: string, questionId: string) => Promise<void>,
): Promise<{ statusCode: number; ctx: TestApp; questionId: string }> {
  let release: () => void = () => undefined;
  let started: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const ai: AiProvider = {
    provider: "test",
    model: "test-model",
    generate() {
      started();
      return gate.then(() => draft);
    },
  };
  const ctx = await createTestApp({ ai });
  const owner = await register(ctx);
  const questionId = await ask(ctx, "生成期间会改变状态");
  const pending = ctx.app.inject({
    method: "POST",
    url: `/api/me/questions/${questionId}/ai-drafts`,
    headers: { cookie: owner },
    payload: {},
  });
  await ready;
  await change(ctx, owner, questionId);
  release();
  const response = await pending;
  return { statusCode: response.statusCode, ctx, questionId };
}

function completedOutputs(ctx: TestApp, questionId: string): string[] {
  const rows = ctx.db
    .prepare("SELECT output FROM ai_generations WHERE question_id = ? AND status = 'completed'")
    .all(questionId) as Array<{ output: string }>;
  return rows.map((row) => row.output);
}

async function register(ctx: TestApp): Promise<string> {
  const response = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: `owner-${randomBytes(4).toString("hex")}@example.com`, password: "password-secret-1", display_name: "阿宁" },
  });
  assert.equal(response.statusCode, 200);
  const cookie = sessionCookie(response);
  const box = await ctx.app.inject({
    method: "POST",
    url: "/api/me/boxes",
    headers: { cookie },
    payload: boxBody(`box-${randomBytes(3).toString("hex")}`),
  });
  assert.equal(box.statusCode, 200);
  return cookie;
}

async function ask(ctx: TestApp, content: string): Promise<string> {
  const response = await ctx.app.inject({
    method: "POST",
    url: `/api/boxes/${(await currentSlug(ctx))}/questions`,
    payload: {
      content,
      is_anonymous: true,
      idempotency_key: randomBytes(8).toString("hex"),
      view_token: randomBytes(32).toString("base64url"),
    },
  });
  assert.equal(response.statusCode, 200);
  return response.json().id as string;
}

async function currentSlug(ctx: TestApp): Promise<string> {
  const row = ctx.db.prepare("SELECT slug FROM question_boxes LIMIT 1").get() as { slug: string };
  return row.slug;
}

async function waitFor(check: () => boolean): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 2000) throw new Error("timed out waiting for generation");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
