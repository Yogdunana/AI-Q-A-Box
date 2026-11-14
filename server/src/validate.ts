import {
  ANONYMOUS_MODES,
  ANSWER_MAX,
  ANSWER_SOURCES,
  BOX_STATUSES,
  DESCRIPTION_MAX,
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  IDEMPOTENCY_MAX,
  LANGUAGES,
  LENGTHS,
  NICKNAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PATCH_STATUSES,
  QUESTION_MAX,
  QUESTION_MIN,
  QUESTION_STATUSES,
  RESERVED_SLUGS,
  SEARCH_MAX,
  SLUG_MAX,
  SLUG_MIN,
  STYLE_NOTES_MAX,
  TITLE_MAX,
  TONES,
  VISIBILITIES,
  type AnonymousMode,
  type AnswerSource,
  type BoxStatus,
  type PatchStatus,
  type QuestionStatus,
  type ReplyLanguage,
  type ReplyLength,
  type ReplyStyle,
  type ReplyTone,
  type ReplyVisibility,
} from "./constants.ts";
import { badRequest, validation } from "./errors.ts";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface BoxWrite {
  slug?: string;
  title?: string;
  description?: string;
  anonymous_mode?: AnonymousMode;
  default_reply_visibility?: ReplyVisibility;
  status?: BoxStatus;
  reply_style?: Partial<ReplyStyle>;
}

export interface SubmitInput {
  content: string;
  is_anonymous: boolean;
  asker_display_name: string;
  idempotency_key: string;
}

export interface AnswerWrite {
  content?: string;
  visibility?: ReplyVisibility;
  source?: AnswerSource;
}

export function readObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw badRequest();
  return body as Record<string, unknown>;
}

export function parseRegister(body: unknown): RegisterInput {
  const record = readObject(body);
  const fields: Record<string, string> = {};
  const displayName = cleanLine(readOptionalString(record, "display_name") ?? "");
  const emailRaw = readOptionalString(record, "email") ?? "";
  const password = readOptionalString(record, "password") ?? "";
  if (!displayName) fields.display_name = "请填写名字。";
  else if (displayName.length > DISPLAY_NAME_MAX) fields.display_name = `名字最多 ${DISPLAY_NAME_MAX} 个字符。`;
  const emailError = emailProblem(emailRaw);
  if (emailError) fields.email = emailError;
  const passwordError = passwordProblem(password, true);
  if (passwordError) fields.password = passwordError;
  if (Object.keys(fields).length > 0) throw validation(fields);
  return { email: emailRaw.trim().toLowerCase(), password, display_name: displayName };
}

export function parseLogin(body: unknown): LoginInput {
  const record = readObject(body);
  const email = readOptionalString(record, "email");
  const password = readOptionalString(record, "password");
  if (email === undefined || password === undefined) throw badRequest();
  if (password.length > PASSWORD_MAX) {
    throw validation({ password: "邮箱或密码不正确。" });
  }
  return { email: email.trim().toLowerCase(), password };
}

export function parseProfile(body: unknown): { display_name: string } {
  const record = readObject(body);
  const displayName = cleanLine(readOptionalString(record, "display_name") ?? "");
  if (!displayName) throw validation({ display_name: "请填写名字。" });
  if (displayName.length > DISPLAY_NAME_MAX) {
    throw validation({ display_name: `名字最多 ${DISPLAY_NAME_MAX} 个字符。` });
  }
  return { display_name: displayName };
}

export function parseBox(body: unknown, mode: "create" | "patch"): BoxWrite {
  const record = readObject(body);
  const fields: Record<string, string> = {};
  const result: BoxWrite = {};

  if (mode === "create" || record.slug !== undefined) {
    const slug = readOptionalString(record, "slug") ?? "";
    const problem = slugProblem(slug);
    if (problem) fields.slug = problem;
    else result.slug = slug;
  }
  if (mode === "create" || record.title !== undefined) {
    const title = cleanLine(readOptionalString(record, "title") ?? "");
    if (!title) fields.title = "请填写标题。";
    else if (title.length > TITLE_MAX) fields.title = `标题最多 ${TITLE_MAX} 个字符。`;
    else result.title = title;
  }
  if (record.description !== undefined || mode === "create") {
    const description = cleanText(readOptionalString(record, "description") ?? "").trim();
    if (description.length > DESCRIPTION_MAX) fields.description = `简介最多 ${DESCRIPTION_MAX} 字。`;
    else result.description = description;
  }
  const anonymous = readEnum(record, "anonymous_mode", ANONYMOUS_MODES, mode === "create");
  if (anonymous.error) fields.anonymous_mode = anonymous.error;
  else if (anonymous.value) result.anonymous_mode = anonymous.value;
  const visibility = readEnum(record, "default_reply_visibility", VISIBILITIES, mode === "create");
  if (visibility.error) fields.default_reply_visibility = visibility.error;
  else if (visibility.value) result.default_reply_visibility = visibility.value;
  const status = readEnum(record, "status", BOX_STATUSES, mode === "create");
  if (status.error) fields.status = status.error;
  else if (status.value) result.status = status.value;

  if (record.reply_style !== undefined || mode === "create") {
    const style = parseStyle(record.reply_style, mode === "create");
    if (style.fields) Object.assign(fields, style.fields);
    else if (style.value) result.reply_style = style.value;
  }

  if (Object.keys(fields).length > 0) throw validation(fields);
  if (mode === "patch" && Object.keys(result).length === 0) throw badRequest();
  return result;
}

export function parseIdempotencyKey(body: unknown): string {
  const record = readObject(body);
  const key = readOptionalString(record, "idempotency_key") ?? "";
  const problem = idempotencyProblem(key);
  if (problem) throw validation({ idempotency_key: problem });
  return key;
}

export function parseSubmit(body: unknown): SubmitInput {
  const record = readObject(body);
  const fields: Record<string, string> = {};
  const key = readOptionalString(record, "idempotency_key") ?? "";
  const keyProblem = idempotencyProblem(key);
  if (keyProblem) fields.idempotency_key = keyProblem;
  const contentRaw = readOptionalString(record, "content");
  let content = "";
  if (contentRaw === undefined) fields.content = "先写下你的问题吧。";
  else {
    const problem = questionProblem(contentRaw);
    if (problem) fields.content = problem;
    else content = contentRaw.replaceAll("\u0000", "").trim();
  }
  const anonymous = record.is_anonymous;
  if (typeof anonymous !== "boolean") fields.is_anonymous = "请选择是否匿名。";
  const nickname = cleanLine(readOptionalString(record, "asker_display_name") ?? "");
  if (nickname.length > NICKNAME_MAX) fields.asker_display_name = `称呼最多 ${NICKNAME_MAX} 个字符。`;
  if (Object.keys(fields).length > 0) throw validation(fields);
  return {
    content,
    is_anonymous: anonymous === true,
    asker_display_name: nickname,
    idempotency_key: key,
  };
}

export function nicknameRequired(): ReturnType<typeof validation> {
  return validation({ asker_display_name: "请留下一个称呼。" });
}

export function parseStatusPatch(body: unknown): PatchStatus {
  const record = readObject(body);
  const status = readOptionalString(record, "status") ?? "";
  if (status === "deleted") throw validation({ status: "请使用删除操作。" });
  if (!isPatchStatus(status)) throw validation({ status: "不支持这个状态。" });
  return status;
}

export function parseListQuery(status: string, q: string): { statuses: QuestionStatus[]; q: string } {
  const statuses = status
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (statuses.some((item) => !isQuestionStatus(item) || item === "deleted")) {
    throw validation({ status: "不支持这个状态。" });
  }
  const needle = q.trim();
  if (needle.length > SEARCH_MAX) throw validation({ q: `搜索最多 ${SEARCH_MAX} 个字符。` });
  return { statuses: statuses as QuestionStatus[], q: needle };
}

export function parseAnswer(body: unknown, mode: "create" | "patch"): AnswerWrite {
  const record = readObject(body);
  const fields: Record<string, string> = {};
  const result: AnswerWrite = {};
  if (mode === "create" || record.content !== undefined) {
    const content = readOptionalString(record, "content");
    if (content === undefined) fields.content = "回复内容不能为空。";
    else {
      const problem = answerProblem(content);
      if (problem) fields.content = problem;
      else result.content = content.replaceAll("\u0000", "").trim();
    }
  }
  const visibility = readEnum(record, "visibility", VISIBILITIES, mode === "create");
  if (visibility.error) fields.visibility = visibility.error;
  else if (visibility.value) result.visibility = visibility.value;
  const source = readEnum(record, "source", ANSWER_SOURCES, mode === "create");
  if (source.error) fields.source = source.error;
  else if (source.value) result.source = source.value;
  if (Object.keys(fields).length > 0) throw validation(fields);
  if (mode === "patch" && Object.keys(result).length === 0) throw badRequest();
  return result;
}

export function parsePublish(body: unknown): ReplyVisibility {
  const record = readObject(body);
  const visibility = readEnum(record, "visibility", VISIBILITIES, true);
  if (visibility.error || !visibility.value) throw validation({ visibility: visibility.error ?? "请选择回复方式。" });
  return visibility.value;
}

export function slugProblem(slug: string): string | null {
  if (!slug) return "请填写链接地址。";
  if (slug.length < SLUG_MIN) return `至少需要 ${SLUG_MIN} 个字符。`;
  if (slug.length > SLUG_MAX) return `最多 ${SLUG_MAX} 个字符。`;
  if (!SLUG_PATTERN.test(slug)) return "只能使用小写字母、数字和连字符，且不能以连字符开头或结尾。";
  if (RESERVED_SLUGS.has(slug)) return "这个地址已被系统保留，请换一个。";
  return null;
}

function parseStyle(
  value: unknown,
  required: boolean,
): { value?: Partial<ReplyStyle>; fields?: Record<string, string> } {
  if (value === undefined) return required ? { fields: { reply_style: "请设置回复风格。" } } : {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { fields: { reply_style: "回复风格格式不正确。" } };
  }
  const record = value as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const style: Partial<ReplyStyle> = {};
  const tone = readEnum(record, "tone", TONES, required);
  if (tone.error) fields.tone = tone.error;
  else if (tone.value) style.tone = tone.value as ReplyTone;
  const length = readEnum(record, "length", LENGTHS, required);
  if (length.error) fields.length = length.error;
  else if (length.value) style.length = length.value as ReplyLength;
  const language = readEnum(record, "language", LANGUAGES, required);
  if (language.error) fields.language = language.error;
  else if (language.value) style.language = language.value as ReplyLanguage;
  if (record.notes !== undefined || required) {
    const notes = cleanText(typeof record.notes === "string" ? record.notes : record.notes === undefined ? "" : "\u0000");
    if (typeof record.notes !== "string" && record.notes !== undefined) fields.notes = "关于你的格式不正确。";
    else if (notes.trim().length > STYLE_NOTES_MAX) fields.notes = `最多 ${STYLE_NOTES_MAX} 字。`;
    else style.notes = notes.trim();
  }
  if (Object.keys(fields).length > 0) return { fields };
  return { value: style };
}

function emailProblem(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "请填写邮箱。";
  if (trimmed.length > EMAIL_MAX || !EMAIL_PATTERN.test(trimmed)) return "邮箱格式不正确。";
  return null;
}

function passwordProblem(password: string, required: boolean): string | null {
  if (!password) return required ? "请填写密码。" : null;
  if (password.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位。`;
  if (password.length > PASSWORD_MAX) return `密码最多 ${PASSWORD_MAX} 位。`;
  return null;
}

function questionProblem(content: string): string | null {
  const trimmed = content.replaceAll("\u0000", "").trim();
  if (trimmed.length === 0) return "先写下你的问题吧。";
  if (trimmed.length < QUESTION_MIN) return "问题太短了，再多写几个字。";
  if (content.length > QUESTION_MAX) return `问题最多 ${QUESTION_MAX} 字，请精简一下。`;
  return null;
}

function answerProblem(content: string): string | null {
  const trimmed = content.replaceAll("\u0000", "").trim();
  if (!trimmed) return "回复内容不能为空。";
  if (content.length > ANSWER_MAX) return `回复最多 ${ANSWER_MAX} 字。`;
  return null;
}

function idempotencyProblem(key: string): string | null {
  if (!key) return "请重新提交一次。";
  if (key.length > IDEMPOTENCY_MAX) return "请重新提交一次。";
  if (/[^\w-]/.test(key)) return "请重新提交一次。";
  return null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  if (record[key] === undefined) return undefined;
  if (typeof record[key] !== "string") throw validation({ [key]: "格式不正确。" });
  return record[key];
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  required: boolean,
): { value?: T; error?: string } {
  const value = record[key];
  if (value === undefined) return required ? { error: "请完成这项设置。" } : {};
  if (typeof value !== "string" || !allowed.includes(value as T)) return { error: "选项不正确。" };
  return { value: value as T };
}

function cleanLine(value: string): string {
  return value.replaceAll(/[\u0000-\u001F\u007F]/g, "").trim();
}

function cleanText(value: string): string {
  return value.replaceAll("\u0000", "");
}

function isQuestionStatus(value: string): value is QuestionStatus {
  return (QUESTION_STATUSES as readonly string[]).includes(value);
}

function isPatchStatus(value: string): value is PatchStatus {
  return (PATCH_STATUSES as readonly string[]).includes(value);
}
