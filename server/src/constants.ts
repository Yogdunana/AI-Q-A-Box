/** Limits mirrored from web/src/lib/validation.ts so both sides reject the same input. */

export const QUESTION_MAX = 1000;
export const QUESTION_MIN = 2;
export const NICKNAME_MAX = 24;
export const ANSWER_MAX = 4000;
export const SLUG_MIN = 3;
export const SLUG_MAX = 32;
export const TITLE_MAX = 40;
export const DESCRIPTION_MAX = 200;
export const DISPLAY_NAME_MAX = 24;
export const STYLE_NOTES_MAX = 600;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 254;
export const IDEMPOTENCY_MAX = 80;
export const SEARCH_MAX = 100;
export const LIST_LIMIT = 1000;
export const DEDUPE_WINDOW_MS = 60_000;
export const GUARD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Slugs share the site root with the SPA, so these can never be claimed. */
export const RESERVED_SLUGS = new Set([
  "app",
  "auth",
  "api",
  "admin",
  "login",
  "logout",
  "register",
  "signup",
  "settings",
  "share",
  "inbox",
  "help",
  "about",
  "privacy",
  "terms",
  "static",
  "assets",
  "brand",
  "public",
  "www",
  "submitted",
  "reply",
]);

export const QUESTION_STATUSES = [
  "submitted",
  "reviewing",
  "drafted",
  "answered_private",
  "published",
  "archived",
  "spam",
  "flagged",
  "deleted",
] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const PATCH_STATUSES = [
  "submitted",
  "reviewing",
  "drafted",
  "answered_private",
  "published",
  "archived",
  "spam",
  "flagged",
] as const;

export type PatchStatus = (typeof PATCH_STATUSES)[number];

export const TONES = ["warm", "direct", "playful", "professional"] as const;
export const LENGTHS = ["short", "medium", "long"] as const;
export const LANGUAGES = ["auto", "zh", "en"] as const;
export const VISIBILITIES = ["private", "public"] as const;
export const ANONYMOUS_MODES = ["allowed", "disabled"] as const;
export const BOX_STATUSES = ["active", "paused"] as const;
export const ANSWER_SOURCES = ["human", "ai_assisted"] as const;
export const DELIVERY_STATES = ["draft", "private_reserved", "published"] as const;

export type ReplyTone = (typeof TONES)[number];
export type ReplyLength = (typeof LENGTHS)[number];
export type ReplyLanguage = (typeof LANGUAGES)[number];
export type ReplyVisibility = (typeof VISIBILITIES)[number];
export type AnonymousMode = (typeof ANONYMOUS_MODES)[number];
export type BoxStatus = (typeof BOX_STATUSES)[number];
export type AnswerSource = (typeof ANSWER_SOURCES)[number];
export type DeliveryState = (typeof DELIVERY_STATES)[number];
export type RiskLevel = "none" | "review";

export interface ReplyStyle {
  tone: ReplyTone;
  length: ReplyLength;
  language: ReplyLanguage;
  notes: string;
}

export const COOKIE_NAME = "askme_session";
export const PROMPT_VERSION = "askme-draft-2026-11-15";
/** 32 bytes of base64url. Shorter values are rejected instead of being stored. */
export const VIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const AI_WRITABLE_STATUSES = [
  "submitted",
  "reviewing",
  "drafted",
  "answered_private",
  "published",
  "flagged",
] as const;
