import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import type { AiProvider } from "../src/ai/index.ts";
import { localReviewDraft } from "../src/risk.ts";
import { boxBody, closeTestApp, createTestApp, sessionCookie, type TestApp } from "./helpers.ts";

const SECRET_EMAIL = "owner-secret-email@example.com";
const SECRET_PASSWORD = "password-secret-1";
const SECRET_QUESTION = "QUESTION_SECRET_TEXT_XYZ";
const STYLE_SECRET = "NOTES_SECRET_8848";

describe("ask me api", () => {
  const apps: TestApp[] = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const ctx = apps.pop();
      if (ctx) await closeTestApp(ctx);
    }
  });

  it("registers, keeps the session on an HttpOnly cookie, and logs out", async () => {
    const ctx = await use();
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "  Person@Example.com ", password: "password-1", display_name: " 阿宁 " },
    });
    assert.equal(created.statusCode, 200);
    const cookie = sessionCookie(created);
    const setCookie = String(created.headers["set-cookie"]);
    assert.match(setCookie, /httponly/i);
    assert.match(setCookie, /samesite=lax/i);
    assert.doesNotMatch(setCookie, /secure/i);
    assert.equal(created.json().user.email, "person@example.com");
    assert.equal(created.json().user.display_name, "阿宁");
    assert.equal(created.json().box, null);
    assert.equal(JSON.stringify(created.json()).includes("password"), false);

    const me = await ctx.app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.display_name, "阿宁");

    const loggedOut = await ctx.app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    assert.equal(loggedOut.statusCode, 204);
    const again = await ctx.app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    assert.equal(again.statusCode, 401);
  });

  it("uses the same message for an unknown email and a wrong password", async () => {
    const ctx = await use();
    await register(ctx.app);
    const unknown = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "missing@example.com", password: SECRET_PASSWORD },
    });
    const wrong = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: SECRET_EMAIL, password: "not-the-password" },
    });
    assert.equal(unknown.statusCode, 401);
    assert.equal(wrong.statusCode, 401);
    assert.equal(unknown.json().message, wrong.json().message);
  });

  it("rejects a foreign origin before creating an account", async () => {
    const ctx = await use();
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/register",
      headers: { origin: "https://evil.example" },
      payload: { email: SECRET_EMAIL, password: SECRET_PASSWORD, display_name: "阿宁" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(count(ctx, "users"), 0);
  });

  it("creates a unique slug and hides the box from other owners", async () => {
    const ctx = await use();
    const owner = await register(ctx.app);
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: owner.cookie },
      payload: boxBody("ning", { reply_style: { ...boxBody("ning").reply_style, notes: STYLE_SECRET } }),
    });
    assert.equal(created.statusCode, 200);
    assert.equal(created.json().slug, "ning");

    const taken = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "other@example.com", password: SECRET_PASSWORD, display_name: "别人" },
    });
    const other = sessionCookie(taken);
    const conflict = await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: other },
      payload: boxBody("ning"),
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().fields.slug, "这个地址已经被使用了。");

    const reserved = await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: other },
      payload: boxBody("app"),
    });
    assert.equal(reserved.statusCode, 422);

    const missing = await ctx.app.inject({ method: "GET", url: "/api/boxes/nobody" });
    const reservedGet = await ctx.app.inject({ method: "GET", url: "/api/boxes/app" });
    const injected = await ctx.app.inject({ method: "GET", url: "/api/boxes/ning%27%20OR%20%271%27%3D%271" });
    assert.equal(missing.statusCode, 404);
    assert.equal(reservedGet.statusCode, 404);
    assert.equal(injected.statusCode, 404);
    assert.equal(missing.json().message, reservedGet.json().message);

    const pub = await ctx.app.inject({ method: "GET", url: "/api/boxes/ning" });
    assert.equal(pub.statusCode, 200);
    assert.deepEqual(Object.keys(pub.json()).sort(), ["accepting", "anonymous_mode", "description", "owner", "slug", "title"]);
    assert.equal(JSON.stringify(pub.json()).includes(SECRET_EMAIL), false);
    assert.equal(JSON.stringify(pub.json()).includes(STYLE_SECRET), false);
    assert.equal(pub.json().owner.display_name, "阿宁");

    const foreign = await ctx.app.inject({
      method: "PATCH",
      url: `/api/me/boxes/${created.json().id}`,
      headers: { cookie: other },
      payload: { title: "偷改" },
    });
    assert.equal(foreign.statusCode, 404);
  });

  it("accepts an anonymous question without storing a nickname, and keeps it in that box only", async () => {
    const ctx = await use();
    const owner = await register(ctx.app);
    await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: owner.cookie },
      payload: boxBody("ning"),
    });
    const submitted = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: {
        content: SECRET_QUESTION,
        is_anonymous: true,
        asker_display_name: "不要保存这个称呼",
        idempotency_key: "key-1",
        view_token: viewToken("key-1"),
      },
    });
    assert.equal(submitted.statusCode, 200);
    assert.deepEqual(Object.keys(submitted.json()), ["id"]);
    const replay = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: { content: "另一段内容", is_anonymous: true, idempotency_key: "key-1", view_token: viewToken("key-1") },
    });
    assert.equal(replay.json().id, submitted.json().id);
    const duplicate = await submit(ctx.app, SECRET_QUESTION, "key-2");
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().id, undefined);
    assert.equal(count(ctx, "questions"), 1);

    const list = await ctx.app.inject({ method: "GET", url: "/api/me/questions", headers: { cookie: owner.cookie } });
    assert.equal(list.json().items[0].content, SECRET_QUESTION);
    assert.equal(list.json().items[0].is_anonymous, true);
    assert.equal(list.json().items[0].asker_display_name, null);

    const other = await register(ctx.app, "other@example.com");
    await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: other.cookie },
      payload: boxBody("other"),
    });
    const hidden = await ctx.app.inject({
      method: "GET",
      url: `/api/me/questions/${submitted.json().id}`,
      headers: { cookie: other.cookie },
    });
    assert.equal(hidden.statusCode, 404);
    const unauthenticated = await ctx.app.inject({ method: "GET", url: "/api/me/questions" });
    assert.equal(unauthenticated.statusCode, 401);
  });

  it("requires a nickname when anonymous questions are disabled and rejects a paused box", async () => {
    const ctx = await use();
    const owner = await register(ctx.app);
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: owner.cookie },
      payload: boxBody("ning", { anonymous_mode: "disabled" }),
    });
    const missingName = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: { content: "没有称呼的问题", is_anonymous: true, idempotency_key: "name-1", view_token: viewToken("name-1") },
    });
    assert.equal(missingName.statusCode, 422);
    assert.equal(missingName.json().fields.asker_display_name, "请留下一个称呼。");
    const named = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: {
        content: "留下称呼的问题",
        is_anonymous: false,
        asker_display_name: "阿远",
        idempotency_key: "name-2",
        view_token: viewToken("name-2"),
      },
    });
    assert.equal(named.statusCode, 200);

    await ctx.app.inject({
      method: "PATCH",
      url: `/api/me/boxes/${created.json().id}`,
      headers: { cookie: owner.cookie },
      payload: { status: "paused" },
    });
    const paused = await ctx.app.inject({ method: "GET", url: "/api/boxes/ning" });
    assert.equal(paused.json().accepting, false);
    const refused = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: {
        content: "暂停后的问题",
        is_anonymous: false,
        asker_display_name: "阿远",
        idempotency_key: "name-3",
        view_token: viewToken("name-3"),
      },
    });
    assert.equal(refused.statusCode, 403);
  });

  it("rate limits repeated submissions without disclosing the threshold", async () => {
    let now = Date.parse("2026-11-15T00:00:00.000Z");
    const ctx = await use({ now: () => now, config: { submitRateLimit: 2, submitRateWindowMs: 60_000 } });
    const owner = await register(ctx.app);
    await ctx.app.inject({ method: "POST", url: "/api/me/boxes", headers: { cookie: owner.cookie }, payload: boxBody("ning") });
    for (let i = 0; i < 2; i += 1) {
      const ok = await submit(ctx.app, `问题 ${i}`, `limit-${i}`);
      assert.equal(ok.statusCode, 200);
    }
    const limited = await submit(ctx.app, "再来一个", "limit-3");
    assert.equal(limited.statusCode, 429);
    assert.equal(/\d/.test(limited.json().message), false);
    const replay = await submit(ctx.app, "问题 0", "limit-0");
    assert.equal(replay.statusCode, 200);
    now += 61_000;
    const later = await submit(ctx.app, "窗口之后", "limit-4");
    assert.equal(later.statusCode, 200);
  });

  it("keeps AI output as an editable draft and never publishes it", async () => {
    const calls: Array<{ question: string; notes: string }> = [];
    const ai: AiProvider = {
      provider: "test",
      model: "test-model",
      generate(input) {
        calls.push({ question: input.question, notes: input.style.notes });
        return Promise.resolve({ text: "草稿 [你的看法]", inputTokens: 4, outputTokens: 3 });
      },
    };
    const ctx = await use({ ai });
    const owner = await register(ctx.app);
    await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: owner.cookie },
      payload: boxBody("ning", { reply_style: { tone: "warm", length: "medium", language: "zh", notes: STYLE_SECRET } }),
    });
    const first = await submit(ctx.app, SECRET_QUESTION, "ai-1");
    await submit(ctx.app, "另一个人的另一个问题", "ai-2");
    const draft = await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${first.json().id}/ai-drafts`,
      headers: { cookie: owner.cookie },
      payload: {},
    });
    assert.equal(draft.statusCode, 200);
    assert.equal(draft.json().output, "草稿 [你的看法]");
    assert.equal(draft.json().provider, "test");
    assert.equal(JSON.stringify(draft.json()).includes("起草助手"), false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.question, SECRET_QUESTION);
    assert.equal(calls[0]?.notes, STYLE_SECRET);
    assert.equal(JSON.stringify(calls).includes("另一个人的另一个问题"), false);
    assert.equal(JSON.stringify(calls).includes(SECRET_EMAIL), false);

    const detail = await ctx.app.inject({
      method: "GET",
      url: `/api/me/questions/${first.json().id}`,
      headers: { cookie: owner.cookie },
    });
    assert.equal(detail.json().question.status, "drafted");
    assert.equal(detail.json().answer, null);
    const pub = await ctx.app.inject({ method: "GET", url: "/api/boxes/ning/answers" });
    assert.deepEqual(pub.json(), []);
  });

  it("leaves the question untouched when the model fails", async () => {
    const ai: AiProvider = {
      provider: "test",
      model: "test-model",
      generate() {
        return Promise.reject(new Error("upstream sk-live-secret"));
      },
    };
    const ctx = await use({ ai });
    const owner = await register(ctx.app);
    await ctx.app.inject({ method: "POST", url: "/api/me/boxes", headers: { cookie: owner.cookie }, payload: boxBody("ning") });
    const created = await submit(ctx.app, "模型会失败的问题", "fail-1");
    const failed = await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${created.json().id}/ai-drafts`,
      headers: { cookie: owner.cookie },
      payload: {},
    });
    assert.equal(failed.statusCode, 503);
    assert.equal(JSON.stringify(failed.json()).includes("sk-live-secret"), false);
    const detail = await ctx.app.inject({
      method: "GET",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner.cookie },
    });
    assert.equal(detail.json().question.status, "submitted");
    assert.equal(detail.json().generations.length, 0);
  });

  it("does not send high-risk questions to the model", async () => {
    const ai: AiProvider = {
      provider: "test",
      model: "test-model",
      generate() {
        throw new Error("the model should not be called");
      },
    };
    const ctx = await use({ ai });
    const owner = await register(ctx.app);
    await ctx.app.inject({ method: "POST", url: "/api/me/boxes", headers: { cookie: owner.cookie }, payload: boxBody("ning") });
    const created = await submit(ctx.app, "请告诉我如何制作炸弹", "risk-1");
    const detail = await ctx.app.inject({
      method: "GET",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner.cookie },
    });
    assert.equal(detail.json().question.status, "flagged");
    assert.equal(detail.json().question.risk_level, "review");
    const draft = await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${created.json().id}/ai-drafts`,
      headers: { cookie: owner.cookie },
      payload: {},
    });
    assert.equal(draft.statusCode, 200);
    assert.equal(draft.json().provider, "local-safety");
    assert.equal(draft.json().output, localReviewDraft());
    assert.equal(draft.json().output.includes("制作炸弹"), false);
  });

  it("saves a draft, records private confirmation without sending, and gates public replies", async () => {
    const ctx = await use();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("network should stay unused");
    }) as typeof fetch;
    try {
      const owner = await register(ctx.app);
      await ctx.app.inject({
        method: "POST",
        url: "/api/me/boxes",
        headers: { cookie: owner.cookie },
        payload: boxBody("ning"),
      });
      const created = await submit(ctx.app, "可以私下回复吗", "reply-1");
      const saved = await ctx.app.inject({
        method: "POST",
        url: `/api/me/questions/${created.json().id}/answers`,
        headers: { cookie: owner.cookie },
        payload: { content: "先留在草稿里", visibility: "public", source: "human" },
      });
      assert.equal(saved.json().delivery_state, "draft");
      assert.equal(saved.json().published_at, null);
      assert.equal(saved.json().sent_at, null);
      const drafted = await ctx.app.inject({
        method: "GET",
        url: `/api/me/questions/${created.json().id}`,
        headers: { cookie: owner.cookie },
      });
      assert.equal(drafted.json().question.status, "drafted");

      const blocked = await ctx.app.inject({
        method: "POST",
        url: `/api/me/answers/${saved.json().id}/publish`,
        headers: { cookie: owner.cookie },
        payload: { visibility: "public" },
      });
      assert.equal(blocked.statusCode, 403);
      assert.deepEqual((await ctx.app.inject({ method: "GET", url: "/api/boxes/ning/answers" })).json(), []);

      const privately = await ctx.app.inject({
        method: "POST",
        url: `/api/me/answers/${saved.json().id}/publish`,
        headers: { cookie: owner.cookie },
        payload: { visibility: "private" },
      });
      assert.equal(privately.statusCode, 200);
      assert.equal(privately.json().delivery_state, "private_reserved");
      assert.equal(privately.json().sent_at === null, false);
      assert.equal(privately.json().confirmed_content, "先留在草稿里");
      assert.equal(privately.json().seen_at, null);
      assert.equal(privately.json().published_at, null);
      const afterPrivate = await ctx.app.inject({
        method: "GET",
        url: `/api/me/questions/${created.json().id}`,
        headers: { cookie: owner.cookie },
      });
      assert.equal(afterPrivate.json().question.status, "answered_private");
      assert.deepEqual((await ctx.app.inject({ method: "GET", url: "/api/boxes/ning/answers" })).json(), []);

      ctx.config.publicRepliesEnabled = true;
      const blockedConsent = await ctx.app.inject({
        method: "POST",
        url: `/api/me/answers/${saved.json().id}/publish`,
        headers: { cookie: owner.cookie },
        payload: { visibility: "public" },
      });
      assert.equal(blockedConsent.statusCode, 403);
      const consented = await submit(ctx.app, "可以公开的问题", "reply-public", { allow_public: true });
      const consentedAnswer = await ctx.app.inject({
        method: "POST",
        url: `/api/me/questions/${consented.json().id}/answers`,
        headers: { cookie: owner.cookie },
        payload: { content: "公开这一段", visibility: "public", source: "human" },
      });
      const published = await ctx.app.inject({
        method: "POST",
        url: `/api/me/answers/${consentedAnswer.json().id}/publish`,
        headers: { cookie: owner.cookie },
        payload: { visibility: "public" },
      });
      assert.equal(published.json().delivery_state, "published");
      assert.deepEqual((await ctx.app.inject({ method: "GET", url: "/api/boxes/ning/answers" })).json(), [
        {
          id: consentedAnswer.json().id,
          question: "可以公开的问题",
          answer: "公开这一段",
          published_at: published.json().published_at,
        },
      ]);

      await ctx.app.inject({
        method: "PATCH",
        url: `/api/me/answers/${consentedAnswer.json().id}`,
        headers: { cookie: owner.cookie },
        payload: { content: "改过但还没再次发布" },
      });
      const stillPublic = await ctx.app.inject({ method: "GET", url: "/api/boxes/ning/answers" });
      assert.equal(stillPublic.json()[0].answer, "公开这一段");

      ctx.config.publicRepliesEnabled = false;
      assert.deepEqual((await ctx.app.inject({ method: "GET", url: "/api/boxes/ning/answers" })).json(), []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("flags, archives, and soft-deletes without letting another owner through", async () => {
    const ctx = await use();
    const owner = await register(ctx.app);
    await ctx.app.inject({ method: "POST", url: "/api/me/boxes", headers: { cookie: owner.cookie }, payload: boxBody("ning") });
    const created = await submit(ctx.app, "待处理的问题", "state-1");
    await submit(ctx.app, "另一个新问题", "state-2");
    const flagged = await ctx.app.inject({
      method: "PATCH",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner.cookie },
      payload: { status: "flagged" },
    });
    assert.equal(flagged.json().status, "flagged");
    assert.equal(flagged.json().risk_level, "review");
    const premature = await ctx.app.inject({
      method: "PATCH",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner.cookie },
      payload: { status: "published" },
    });
    assert.equal(premature.statusCode, 422);
    const other = await register(ctx.app, "other@example.com");
    const stolen = await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${created.json().id}/ai-drafts`,
      headers: { cookie: other.cookie },
      payload: {},
    });
    assert.equal(stolen.statusCode, 404);
    await ctx.app.inject({
      method: "PATCH",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner.cookie },
      payload: { status: "archived" },
    });
    await ctx.app.inject({
      method: "DELETE",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner.cookie },
    });
    const gone = await ctx.app.inject({
      method: "GET",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner.cookie },
    });
    assert.equal(gone.statusCode, 404);
    const list = await ctx.app.inject({
      method: "GET",
      url: "/api/me/questions?status=submitted&q=另一个",
      headers: { cookie: owner.cookie },
    });
    assert.equal(list.json().items.length, 1);
    assert.equal(list.json().total, 1);
    assert.equal(list.json().counts.submitted, 1);
    assert.equal(list.json().items.some((item: { content: string }) => item.content === "待处理的问题"), false);

    const denied = await ctx.app.inject({
      method: "DELETE",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: other.cookie },
    });
    assert.equal(denied.statusCode, 404);
  });

  it("writes audit rows without question text, email, passwords, or model output", async () => {
    const ctx = await use();
    const owner = await register(ctx.app);
    await ctx.app.inject({
      method: "POST",
      url: "/api/me/boxes",
      headers: { cookie: owner.cookie },
      payload: boxBody("ning", { reply_style: { tone: "warm", length: "short", language: "zh", notes: STYLE_SECRET } }),
    });
    const created = await submit(ctx.app, SECRET_QUESTION, "audit-1");
    await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${created.json().id}/ai-drafts`,
      headers: { cookie: owner.cookie },
      payload: {},
    });
    const rows = ctx.db.prepare("SELECT action, metadata FROM audit_logs").all() as Array<{ action: string; metadata: string }>;
    const blob = rows.map((row) => `${row.action} ${row.metadata}`).join("\n");
    assert.equal(blob.includes(SECRET_QUESTION), false);
    assert.equal(blob.includes(SECRET_EMAIL), false);
    assert.equal(blob.includes(SECRET_PASSWORD), false);
    assert.equal(blob.includes(STYLE_SECRET), false);
    assert.equal(rows.some((row) => row.action === "question.submit"), true);
    assert.equal(rows.some((row) => row.action === "ai.draft"), true);
  });

  it("hides unexpected failures and keeps health free of configuration", async () => {
    const ctx = await use({
      extraRoutes(app) {
        app.get("/api/boom", async () => {
          throw new Error("SECRET_BOOM sk-live");
        });
      },
    });
    const boom = await ctx.app.inject({ method: "GET", url: "/api/boom" });
    assert.equal(boom.statusCode, 500);
    assert.equal(boom.json().message, "服务暂时不可用，请稍后重试。");
    assert.equal(JSON.stringify(boom.json()).includes("SECRET_BOOM"), false);
    const health = await ctx.app.inject({ method: "GET", url: "/api/health" });
    assert.deepEqual(health.json(), { ok: true });
    assert.equal(JSON.stringify(health.json()).includes(ctx.config.sessionSecret), false);
  });

  async function use(options: Parameters<typeof createTestApp>[0] = {}): Promise<TestApp> {
    const ctx = await createTestApp(options);
    apps.push(ctx);
    return ctx;
  }
});

async function register(app: FastifyInstance, email = SECRET_EMAIL) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: SECRET_PASSWORD, display_name: "阿宁" },
  });
  assert.equal(response.statusCode, 200);
  return { cookie: sessionCookie(response), body: response.json() };
}

const viewTokens = new Map<string, string>();

function viewToken(key: string): string {
  let token = viewTokens.get(key);
  if (!token) {
    token = randomBytes(32).toString("base64url");
    viewTokens.set(key, token);
  }
  return token;
}

function submit(app: FastifyInstance, content: string, key: string, extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/boxes/ning/questions",
    payload: { content, is_anonymous: true, idempotency_key: key, view_token: viewToken(key), ...extra },
  });
}

function count(ctx: TestApp, table: "users" | "questions"): number {
  const row = ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number | bigint } | undefined;
  return Number(row?.n ?? 0);
}
