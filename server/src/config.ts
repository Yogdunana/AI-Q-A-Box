import { resolve } from "node:path";
import { COOKIE_NAME } from "./constants.ts";

export type AppEnv = "development" | "test" | "production";
export type AiProviderName = "mock" | "openai";

export interface Config {
  env: AppEnv;
  host: string;
  port: number;
  databasePath: string;
  sessionSecret: string;
  ipPepper: string;
  sessionTtlMs: number;
  cookieSecure: boolean;
  cookieName: string;
  webOrigins: string[];
  trustProxy: boolean;
  publicRepliesEnabled: boolean;
  autoFlagRisk: boolean;
  aiProvider: AiProviderName;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiTimeoutMs: number;
  submitRateLimit: number;
  submitRateWindowMs: number;
  authRateLimit: number;
  authRateWindowMs: number;
  aiRateLimit: number;
  aiRateWindowMs: number;
  publicReadRateLimit: number;
  publicReadRateWindowMs: number;
  dedupeWindowMs: number;
  guardRetentionMs: number;
  bodyLimit: number;
  requestTimeoutMs: number;
  viewTokenPepper: string;
  aiMaxOutputTokens: number;
  aiDailyLimit: number;
  aiMaxConcurrent: number;
  replyRateLimit: number;
  replyRateWindowMs: number;
}

const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const nodeEnv = env.NODE_ENV === "production" || env.NODE_ENV === "test" ? env.NODE_ENV : "development";
  const sessionSecret = requiredSecret(env.SESSION_SECRET, "SESSION_SECRET", nodeEnv);
  const pepperSource = env.IP_HASH_PEPPER?.trim() ? env.IP_HASH_PEPPER : sessionSecret;
  const ipPepper = requiredSecret(pepperSource, "IP_HASH_PEPPER", nodeEnv);
  const aiProvider = readProvider(env.AI_PROVIDER);
  const aiApiKey = env.AI_API_KEY?.trim() ?? "";
  if (aiProvider === "openai" && aiApiKey.length === 0) {
    throw new Error("AI_API_KEY is required when AI_PROVIDER=openai");
  }
  const aiBaseUrl = normalizeBaseUrl(env.AI_BASE_URL?.trim() || "https://api.openai.com/v1");
  const webOrigins = readOrigins(env.WEB_ORIGINS, nodeEnv);
  const aiTimeoutMs = clamp(integer(env.AI_TIMEOUT_MS, 20_000), 1_000, 60_000);

  return {
    env: nodeEnv,
    host: env.HOST?.trim() || "127.0.0.1",
    port: clamp(integer(env.PORT, 8787), 1, 65535),
    databasePath: resolve(env.DATABASE_PATH?.trim() || "data/askme.sqlite"),
    sessionSecret,
    ipPepper,
    sessionTtlMs: clamp(integer(env.SESSION_TTL_DAYS, 14), 1, 90) * 24 * 60 * 60 * 1000,
    cookieSecure: bool(env.COOKIE_SECURE, nodeEnv === "production"),
    cookieName: COOKIE_NAME,
    webOrigins,
    trustProxy: bool(env.TRUST_PROXY, false),
    publicRepliesEnabled: bool(env.PUBLIC_REPLIES_ENABLED, false),
    autoFlagRisk: bool(env.AUTO_FLAG_RISK, true),
    aiProvider,
    aiBaseUrl,
    aiApiKey,
    aiModel: (env.AI_MODEL?.trim() || "gpt-4o-mini").slice(0, 80),
    aiTimeoutMs,
    submitRateLimit: clamp(integer(env.SUBMIT_RATE_LIMIT, 5), 1, 1000),
    submitRateWindowMs: clamp(integer(env.SUBMIT_RATE_WINDOW_MS, 60_000), 1_000, 24 * 60 * 60 * 1000),
    authRateLimit: clamp(integer(env.AUTH_RATE_LIMIT, 20), 1, 10_000),
    authRateWindowMs: clamp(integer(env.AUTH_RATE_WINDOW_MS, 900_000), 1_000, 24 * 60 * 60 * 1000),
    aiRateLimit: clamp(integer(env.AI_RATE_LIMIT, 30), 1, 10_000),
    aiRateWindowMs: clamp(integer(env.AI_RATE_WINDOW_MS, 3_600_000), 1_000, 24 * 60 * 60 * 1000),
    publicReadRateLimit: clamp(integer(env.PUBLIC_READ_RATE_LIMIT, 180), 1, 100_000),
    publicReadRateWindowMs: clamp(integer(env.PUBLIC_READ_RATE_WINDOW_MS, 60_000), 1_000, 24 * 60 * 60 * 1000),
    dedupeWindowMs: clamp(integer(env.DEDUPE_WINDOW_MS, 60_000), 0, 10 * 60 * 1000),
    guardRetentionMs: clamp(integer(env.GUARD_RETENTION_MS, 7 * 24 * 60 * 60 * 1000), 60_000, 90 * 24 * 60 * 60 * 1000),
    bodyLimit: 64 * 1024,
    requestTimeoutMs: aiTimeoutMs + 15_000,
    viewTokenPepper: requiredSecret(env.VIEW_TOKEN_PEPPER?.trim() ? env.VIEW_TOKEN_PEPPER : sessionSecret, "VIEW_TOKEN_PEPPER", nodeEnv),
    aiMaxOutputTokens: clamp(integer(env.AI_MAX_OUTPUT_TOKENS, 1024), 64, 4096),
    aiDailyLimit: clamp(integer(env.AI_DAILY_LIMIT, 40), 1, 10_000),
    aiMaxConcurrent: clamp(integer(env.AI_MAX_CONCURRENT, 2), 1, 20),
    replyRateLimit: clamp(integer(env.REPLY_RATE_LIMIT, 30), 1, 10_000),
    replyRateWindowMs: clamp(integer(env.REPLY_RATE_WINDOW_MS, 60_000), 1_000, 24 * 60 * 60 * 1000),
  };
}

function requiredSecret(value: string | undefined, name: string, env: AppEnv): string {
  const secret = value?.trim() ?? "";
  if (secret.length < 32) throw new Error(`${name} must be at least 32 characters`);
  if (env === "production" && secret.includes("replace-with")) {
    throw new Error(`${name} is still a placeholder`);
  }
  return secret;
}

function readProvider(value: string | undefined): AiProviderName {
  if (value === undefined || value === "" || value === "mock") return "mock";
  if (value === "openai") return "openai";
  throw new Error("AI_PROVIDER must be mock or openai");
}

function readOrigins(value: string | undefined, env: AppEnv): string[] {
  const origins = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (env === "production" && origins.length === 0) throw new Error("WEB_ORIGINS is required in production");
  return origins.length > 0 ? origins : DEV_ORIGINS;
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("AI_BASE_URL is invalid");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("AI_BASE_URL must not include credentials, query, or hash");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("AI_BASE_URL must be http or https");
  }
  return url.toString().replace(/\/$/, "");
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error("Invalid boolean environment value");
}

function integer(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Invalid integer environment value");
  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
