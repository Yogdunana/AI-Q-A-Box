import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { hashToken } from "../src/crypto.ts";
import { boxBody, closeTestApp, createTestApp, sessionCookie, type TestApp } from "./helpers.ts";

const SECRET = "VIEW_TOKEN_MUST_NOT_LEAK_9f3a";
const QUESTION = "只有持有链接的人能看到";

describe("asker reply links", () => {
  const apps: TestApp[] = [];

  afterEach(async () => {
    while (apps.length > 0) {
      const ctx = apps.pop();
      if (ctx) await closeTestApp(ctx);
    }
  });

  it("returns a pending reply, then only the confirmed snapshot, and hides drafts", async () => {
    const ctx = await use();
    const owner = await register(ctx.app);
    await ctx.app.inject({ method: "POST", url: "/api/me/boxes", headers: { cookie: owner }, payload: boxBody("ning") });
    const token = randomBytes(32).toString("base64url");
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: { content: QUESTION, is_anonymous: true, idempotency_key: "idem-1", view_token: token },
    });
    assert.equal(created.statusCode, 200);
    const stored = ctx.db.prepare("SELECT view_token_hash FROM questions WHERE id = ?").get(created.json().id) as {
      view_token_hash: string;
    };
    assert.equal(stored.view_token_hash, hashToken(ctx.config.viewTokenPepper, token));
    assert.equal(stored.view_token_hash.includes(token), false);

    const pending = await access(ctx.app, token);
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.json().state, "pending");
    assert.equal(pending.json().reply, null);
    assert.equal(pending.json().question.content, QUESTION);
    assert.equal(JSON.stringify(pending.json()).includes("owner_id"), false);

    const mismatched = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: { content: "另一段", is_anonymous: true, idempotency_key: "idem-1", view_token: randomBytes(32).toString("base64url") },
    });
    assert.equal(mismatched.statusCode, 409);
    assert.equal(mismatched.json().id, undefined);

    const saved = await ctx.app.inject({
      method: "POST",
      url: `/api/me/questions/${created.json().id}/answers`,
      headers: { cookie: owner },
      payload: { content: "草稿还不能看", visibility: "private", source: "human" },
    });
    const stillPending = await access(ctx.app, token);
    assert.equal(stillPending.json().state, "pending");
    assert.equal(JSON.stringify(stillPending.json()).includes("草稿还不能看"), false);

    const confirmed = await ctx.app.inject({
      method: "POST",
      url: `/api/me/answers/${saved.json().id}/publish`,
      headers: { cookie: owner },
      payload: { visibility: "private" },
    });
    assert.equal(confirmed.json().seen_at, null);
    const visible = await access(ctx.app, token);
    assert.equal(visible.json().state, "confirmed");
    assert.equal(visible.json().reply.content, "草稿还不能看");
    const seen = await ctx.app.inject({
      method: "GET",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner },
    });
    assert.equal(seen.json().answer.seen_at === null, false);

    await ctx.app.inject({
      method: "PATCH",
      url: `/api/me/answers/${saved.json().id}`,
      headers: { cookie: owner },
      payload: { content: "还没再次确认的修改", draft_revision: seen.json().answer.draft_revision + 1 },
    });
    const unchanged = await access(ctx.app, token);
    assert.equal(unchanged.json().reply.content, "草稿还不能看");
    assert.equal(JSON.stringify(unchanged.json()).includes("还没再次确认的修改"), false);

    const stale = await ctx.app.inject({
      method: "PATCH",
      url: `/api/me/answers/${saved.json().id}`,
      headers: { cookie: owner },
      payload: { content: "更旧的请求", draft_revision: 1 },
    });
    assert.equal(stale.json().content, "还没再次确认的修改");

    await ctx.app.inject({
      method: "DELETE",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: owner },
    });
    const deleted = await access(ctx.app, token);
    assert.equal(deleted.json().state, "deleted");
    assert.equal(deleted.json().question, undefined);
    assert.equal(JSON.stringify(deleted.json()).includes(QUESTION), false);
  });

  it("rejects question ids, idempotency keys, and other people's tokens", async () => {
    const logs: string[] = [];
    const ctx = await use({
      logger: {
        level: "info",
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
          },
        }),
      },
      extraRoutes(app) {
        app.post("/api/boom", async () => {
          throw new Error("boom");
        });
      },
    });
    const owner = await register(ctx.app);
    await ctx.app.inject({ method: "POST", url: "/api/me/boxes", headers: { cookie: owner }, payload: boxBody("ning") });
    const token = `${SECRET}${"a".repeat(43 - SECRET.length)}`;
    assert.equal(token.length, 43);
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/boxes/ning/questions",
      payload: { content: QUESTION, is_anonymous: true, idempotency_key: "idem-secret", view_token: token },
    });
    const byId = await access(ctx.app, created.json().id.padEnd(43, "x").slice(0, 43));
    assert.equal(byId.statusCode, 404);
    const byKey = await ctx.app.inject({
      method: "POST",
      url: "/api/reply-access",
      payload: { token: "idem-secret-idem-secret-idem-secret-idem" },
    });
    assert.equal(byKey.statusCode, 404);
    const stranger = randomBytes(32).toString("base64url");
    assert.equal((await access(ctx.app, stranger)).statusCode, 404);

    const other = await register(ctx.app, "other@example.com");
    const hidden = await ctx.app.inject({
      method: "GET",
      url: `/api/me/questions/${created.json().id}`,
      headers: { cookie: other },
    });
    assert.equal(hidden.statusCode, 404);

    await ctx.app.inject({ method: "POST", url: "/api/boom", payload: { token } });
    const blob = logs.join("\n");
    assert.equal(blob.includes(token), false);
    assert.equal(blob.includes(QUESTION), false);
    const audits = ctx.db.prepare("SELECT metadata FROM audit_logs").all() as Array<{ metadata: string }>;
    assert.equal(audits.some((row) => row.metadata.includes(token) || row.metadata.includes(QUESTION)), false);

    const capabilities = await ctx.app.inject({ method: "GET", url: "/api/capabilities" });
    assert.deepEqual(capabilities.json(), {
      public_replies_enabled: false,
      asker_access: "link",
      notifications: "none",
    });
  });

  async function use(options: Parameters<typeof createTestApp>[0] = {}): Promise<TestApp> {
    const ctx = await createTestApp(options);
    apps.push(ctx);
    return ctx;
  }
});

async function register(app: FastifyInstance, email = "owner-secret-email@example.com") {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email, password: "password-secret-1", display_name: "阿宁" },
  });
  assert.equal(response.statusCode, 200);
  return sessionCookie(response);
}

function access(app: FastifyInstance, token: string) {
  return app.inject({ method: "POST", url: "/api/reply-access", payload: { token } });
}
