import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.ts";
import { hashPassword, passwordMatches } from "../src/crypto.ts";
import { decideDelivery } from "../src/delivery.ts";
import { openDatabase } from "../src/db.ts";
import { migrate, migrationsDir } from "../src/migrate.ts";

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
      () =>
        decideDelivery({
          visibility: "public",
          content: "你好",
          now: "2026-11-15T00:00:00.000Z",
          publicRepliesEnabled: false,
          publicConsent: true,
        }),
      /没有公开/,
    );
    const reserved = decideDelivery({
      visibility: "private",
      content: "你好",
      now: "2026-11-15T00:00:00.000Z",
      publicRepliesEnabled: false,
      publicConsent: false,
    });
    assert.equal(reserved.delivery_state, "private_reserved");
    assert.equal(reserved.sent_at, "2026-11-15T00:00:00.000Z");
    assert.equal(reserved.confirmed_at, "2026-11-15T00:00:00.000Z");
    assert.equal(reserved.published_content, null);
    assert.throws(
      () =>
        decideDelivery({
          visibility: "public",
          content: "你好",
          now: "2026-11-15T00:00:00.000Z",
          publicRepliesEnabled: true,
          publicConsent: false,
        }),
      /没有同意公开/,
    );
    const published = decideDelivery({
      visibility: "public",
      content: "你好",
      now: "2026-11-15T00:00:00.000Z",
      publicRepliesEnabled: true,
      publicConsent: true,
    });
    assert.equal(published.delivery_state, "published");
    assert.equal(published.published_content, "你好");
    assert.equal(published.sent_at, null);
  });

  it("applies migrations once", () => {
    const db = openDatabase(":memory:");
    assert.deepEqual(migrate(db), ["001_init.sql", "002_reply_access.sql"]);
    assert.deepEqual(migrate(db), []);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    for (const name of ["users", "question_boxes", "questions", "answers", "ai_generations", "audit_logs"]) {
      assert.equal(tables.some((table) => table.name === name), true);
    }
    db.close();
  });

  it("does not turn old private reservations into a viewable or read snapshot", () => {
    const db = openDatabase(":memory:");
    db.exec(readFileSync(join(migrationsDir(), "001_init.sql"), "utf8"));
    db.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES ('001_init.sql', ?)").run("2026-11-15T00:00:00.000Z");
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, avatar_url, created_at, deleted_at)
       VALUES ('u1', 'old@example.com', 'hash', '旧箱主', NULL, '2026-11-01T00:00:00.000Z', NULL)`,
    ).run();
    db.prepare(
      `INSERT INTO question_boxes (
        id, owner_id, slug, title, description, anonymous_mode, default_reply_visibility, status,
        reply_tone, reply_length, reply_language, reply_notes, created_at
      ) VALUES ('b1', 'u1', 'oldbox', '旧箱', '', 'allowed', 'private', 'active', 'warm', 'medium', 'zh', '', '2026-11-01T00:00:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO questions (
        id, box_id, content, asker_display_name, is_anonymous, status, risk_level, submitted_at, deleted_at
      ) VALUES ('q1', 'b1', '旧问题', NULL, 1, 'answered_private', 'none', '2026-11-02T00:00:00.000Z', NULL)`,
    ).run();
    db.prepare(
      `INSERT INTO answers (
        id, question_id, content, published_content, visibility, source, delivery_state, updated_at, published_at, sent_at
      ) VALUES ('a1', 'q1', '后来改过的草稿', NULL, 'private', 'human', 'private_reserved', '2026-11-03T00:00:00.000Z', NULL, '2026-11-02T01:00:00.000Z')`,
    ).run();

    assert.deepEqual(migrate(db), ["002_reply_access.sql"]);
    const row = db.prepare("SELECT delivery_state, confirmed_content, confirmed_at, seen_at, sent_at FROM answers WHERE id = 'a1'").get() as {
      delivery_state: string;
      confirmed_content: string | null;
      confirmed_at: string | null;
      seen_at: string | null;
      sent_at: string | null;
    };
    assert.equal(row.delivery_state, "private_reserved");
    assert.equal(row.confirmed_content, null);
    assert.equal(row.seen_at, null);
    assert.equal(row.confirmed_at, "2026-11-02T01:00:00.000Z");
    assert.equal(row.sent_at, row.confirmed_at);
    const question = db.prepare("SELECT public_consent, view_token_hash FROM questions WHERE id = 'q1'").get() as {
      public_consent: number;
      view_token_hash: string | null;
    };
    assert.equal(question.public_consent, 0);
    assert.equal(question.view_token_hash, null);
    db.close();
  });
});
