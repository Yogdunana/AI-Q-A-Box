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

/** Slugs share the root namespace with app routes, so these can never be claimed. */
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
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-");
}

export function validateSlug(slug: string): string | null {
  if (!slug) return "请填写链接地址。";
  if (slug.length < SLUG_MIN) return `至少需要 ${SLUG_MIN} 个字符。`;
  if (slug.length > SLUG_MAX) return `最多 ${SLUG_MAX} 个字符。`;
  if (!SLUG_PATTERN.test(slug)) return "只能使用小写字母、数字和连字符，且不能以连字符开头或结尾。";
  if (RESERVED_SLUGS.has(slug)) return "这个地址已被系统保留，请换一个。";
  return null;
}

export function validateQuestion(content: string): string | null {
  const length = content.trim().length;
  if (length === 0) return "先写下你的问题吧。";
  if (length < QUESTION_MIN) return "问题太短了，再多写几个字。";
  if (content.length > QUESTION_MAX) return `问题最多 ${QUESTION_MAX} 字，请精简一下。`;
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "请填写邮箱。";
  if (!EMAIL_PATTERN.test(email.trim())) return "邮箱格式不正确。";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "请填写密码。";
  if (password.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位。`;
  return null;
}

export function validateRequired(value: string, label: string, max?: number): string | null {
  if (!value.trim()) return `请填写${label}。`;
  if (max !== undefined && value.length > max) return `${label}最多 ${max} 个字符。`;
  return null;
}
