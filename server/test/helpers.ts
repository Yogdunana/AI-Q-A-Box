import type { FastifyInstance } from "fastify";
import { createMockProvider, type AiProvider } from "../src/ai/index.ts";
import { buildApp, type BuildOptions } from "../src/app.ts";
import { loadConfig, type Config } from "../src/config.ts";
import { openDatabase } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";
import type { DatabaseSync } from "node:sqlite";

export interface TestApp {
  app: FastifyInstance;
  db: DatabaseSync;
  config: Config;
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  const base = loadConfig({
    NODE_ENV: "test",
    SESSION_SECRET: "test-session-secret-value-32chars-min",
    IP_HASH_PEPPER: "test-ip-pepper-value-not-a-real-secret",
    WEB_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
    PUBLIC_REPLIES_ENABLED: "false",
    COOKIE_SECURE: "false",
    AI_PROVIDER: "mock",
    AUTH_RATE_LIMIT: "1000",
    AI_RATE_LIMIT: "1000",
    PUBLIC_READ_RATE_LIMIT: "10000",
    SUBMIT_RATE_LIMIT: "8",
  });
  return { ...base, ...overrides, env: "test" };
}

export async function createTestApp(options: {
  now?: () => number;
  config?: Partial<Config>;
  ai?: AiProvider;
  extraRoutes?: BuildOptions["extraRoutes"];
} = {}): Promise<TestApp> {
  const db = openDatabase(":memory:");
  migrate(db);
  const config = testConfig(options.config);
  const app = buildApp({
    db,
    config,
    now: options.now,
    ai: options.ai ?? createMockProvider(),
    extraRoutes: options.extraRoutes,
  });
  await app.ready();
  return { app, db, config };
}

export async function closeTestApp(ctx: TestApp): Promise<void> {
  await ctx.app.close();
  ctx.db.close();
}

export function sessionCookie(response: { headers: object }, name = "askme_session"): string {
  const raw = (response.headers as Record<string, unknown>)["set-cookie"];
  const lines = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
  const line = lines.find((item) => item.startsWith(`${name}=`));
  if (!line) throw new Error("missing session cookie");
  const cookie = line.split(";")[0];
  if (!cookie) throw new Error("missing session cookie");
  return cookie;
}

export const replyStyle = { tone: "warm", length: "medium", language: "auto", notes: "" } as const;

export function boxBody(slug: string, patch: Record<string, unknown> = {}) {
  return {
    slug,
    title: "问我任何事",
    description: "想问就问",
    anonymous_mode: "allowed",
    default_reply_visibility: "private",
    status: "active",
    reply_style: replyStyle,
    ...patch,
  };
}
