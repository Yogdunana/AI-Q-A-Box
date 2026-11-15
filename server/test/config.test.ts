import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.ts";
import { hashPassword, passwordMatches } from "../src/crypto.ts";
import { decideDelivery } from "../src/delivery.ts";
import { openDatabase } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";

describe("configuration and delivery", () => {
  it("refuses a short or placeholder production secret without echoing it", () => {
    assert.throws(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "short" }), /at least 32/);
    const secret = "replace-with-super-secret-value-do-not-leak";
    assert.throws(
      () => loadConfig({ NODE_ENV: "production", SESSION_SECRET: secret, WEB_ORIGINS: "https://example.com" }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /placeholder/);
        assert.equal(error.message.includes(secret), false);
        return true;
      },
    );
  });

  it("defaults to a closed public page and a mock model", () => {
    const config = loadConfig({
      NODE_ENV: "development",
      SESSION_SECRET: "replace-with-a-random-string-at-least-32-chars",
    });
    assert.equal(config.publicRepliesEnabled, false);
    assert.equal(config.aiProvider, "mock");
    assert.equal(config.cookieSecure, false);
    assert.equal(config.host, "127.0.0.1");
  });

  it("requires an API key only when a remote model is selected", () => {
    assert.throws(
      () =>
        loadConfig({
          NODE_ENV: "development",
          SESSION_SECRET: "x".repeat(32),
          AI_PROVIDER: "openai",
          AI_API_KEY: "",
        }),
      /AI_API_KEY is required/,
    );
  });

  it("hashes passwords so the stored value is not the password", () => {
    const hash = hashPassword("password-secret-1");
    assert.equal(hash.includes("password-secret-1"), false);
    assert.equal(passwordMatches("password-secret-1", hash), true);
    assert.equal(passwordMatches("other-password", hash), false);
    assert.equal(passwordMatches("password-secret-1", null), false);
  });

  it("does not publish or pretend to deliver without an explicit choice", () => {
    assert.throws(
      () => decideDelivery({ visibility: "public", content: "你好", now: "2026-11-15T00:00:00.000Z", publicRepliesEnabled: false }),
      /没有公开/,
    );
    const reserved = decideDelivery({
      visibility: "private",
      content: "你好",
      now: "2026-11-15T00:00:00.000Z",
      publicRepliesEnabled: false,
    });
    assert.equal(reserved.delivery_state, "private_reserved");
    assert.equal(reserved.sent_at, "2026-11-15T00:00:00.000Z");
    assert.equal(reserved.published_content, null);
    const published = decideDelivery({
      visibility: "public",
      content: "你好",
      now: "2026-11-15T00:00:00.000Z",
      publicRepliesEnabled: true,
    });
    assert.equal(published.delivery_state, "published");
    assert.equal(published.published_content, "你好");
    assert.equal(published.sent_at, null);
  });

  it("applies migrations once", () => {
    const db = openDatabase(":memory:");
    assert.deepEqual(migrate(db), ["001_init.sql"]);
    assert.deepEqual(migrate(db), []);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    for (const name of ["users", "question_boxes", "questions", "answers", "ai_generations", "audit_logs"]) {
      assert.equal(tables.some((table) => table.name === name), true);
    }
    db.close();
  });
});
