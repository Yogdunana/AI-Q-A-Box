import type { DatabaseSync } from "node:sqlite";
import {
  AI_WRITABLE_STATUSES,
  LIST_LIMIT,
  type AnonymousMode,
  type AnswerSource,
  type BoxStatus,
  type DeliveryState,
  type QuestionStatus,
  type ReplyLanguage,
  type ReplyLength,
  type ReplyStyle,
  type ReplyTone,
  type ReplyVisibility,
  type RiskLevel,
} from "./constants.ts";
import { changed, withTransaction } from "./db.ts";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface BoxRecord {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string;
  anonymous_mode: AnonymousMode;
  default_reply_visibility: ReplyVisibility;
  status: BoxStatus;
  reply_style: ReplyStyle;
  created_at: string;
  owner_display_name?: string;
  owner_avatar_url?: string | null;
}

export interface QuestionRecord {
  id: string;
  box_id: string;
  content: string;
  asker_display_name: string | null;
  is_anonymous: boolean;
  status: QuestionStatus;
  risk_level: RiskLevel;
  submitted_at: string;
  public_consent: boolean;
}

export interface AnswerRecord {
  id: string;
  question_id: string;
  content: string;
  visibility: ReplyVisibility;
  source: AnswerSource;
  delivery_state: DeliveryState;
  updated_at: string;
  published_at: string | null;
  sent_at: string | null;
  published_content: string | null;
  confirmed_content: string | null;
  confirmed_at: string | null;
  seen_at: string | null;
  draft_revision: number;
}

export interface GenerationRecord {
  id: string;
  question_id: string;
  provider: string;
  model: string;
  prompt_version: string;
  output: string;
  status: "completed" | "failed";
  created_at: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms?: number | null;
  error_code?: string | null;
}

interface BoxRow {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string;
  anonymous_mode: AnonymousMode;
  default_reply_visibility: ReplyVisibility;
  status: BoxStatus;
  reply_tone: ReplyTone;
  reply_length: ReplyLength;
  reply_language: ReplyLanguage;
  reply_notes: string;
  created_at: string;
  owner_display_name?: string;
  owner_avatar_url?: string | null;
}

interface QuestionRow {
  id: string;
  box_id: string;
  content: string;
  asker_display_name: string | null;
  is_anonymous: number;
  status: QuestionStatus;
  risk_level: RiskLevel;
  submitted_at: string;
  public_consent: number;
}

interface AnswerRow {
  id: string;
  question_id: string;
  content: string;
  published_content: string | null;
  visibility: ReplyVisibility;
  source: AnswerSource;
  delivery_state: DeliveryState;
  updated_at: string;
  published_at: string | null;
  sent_at: string | null;
  confirmed_content: string | null;
  confirmed_at: string | null;
  seen_at: string | null;
  draft_revision: number;
}

const BOX_COLUMNS = `b.id, b.owner_id, b.slug, b.title, b.description, b.anonymous_mode,
  b.default_reply_visibility, b.status, b.reply_tone, b.reply_length, b.reply_language,
  b.reply_notes, b.created_at`;

export function toPublicUser(row: UserRecord): PublicUser {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
  };
}

export function insertUser(db: DatabaseSync, user: UserRecord): void {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, avatar_url, created_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(user.id, user.email, user.password_hash, user.display_name, user.avatar_url, user.created_at);
}

export function findUserByEmail(db: DatabaseSync, email: string): UserRecord | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(email) as UserRecord | undefined;
}

export function findUserById(db: DatabaseSync, id: string): UserRecord | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | undefined;
}

export function updateDisplayName(db: DatabaseSync, id: string, displayName: string): void {
  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, id);
}

export function insertSession(
  db: DatabaseSync,
  session: { tokenHash: string; userId: string; createdAt: string; expiresAt: string },
): void {
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, NULL)`,
  ).run(session.tokenHash, session.userId, session.createdAt, session.expiresAt);
}

export function findSession(db: DatabaseSync, tokenHash: string): { user_id: string; expires_at: string; revoked_at: string | null } | undefined {
  return db
    .prepare("SELECT user_id, expires_at, revoked_at FROM sessions WHERE token_hash = ?")
    .get(tokenHash) as { user_id: string; expires_at: string; revoked_at: string | null } | undefined;
}

export function deleteSession(db: DatabaseSync, tokenHash: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function revokeSession(db: DatabaseSync, tokenHash: string, at: string): void {
  db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(at, tokenHash);
}

export function insertBox(
  db: DatabaseSync,
  box: BoxRecord,
): void {
  const style = box.reply_style;
  db.prepare(
    `INSERT INTO question_boxes (
      id, owner_id, slug, title, description, anonymous_mode, default_reply_visibility, status,
      reply_tone, reply_length, reply_language, reply_notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    box.id,
    box.owner_id,
    box.slug,
    box.title,
    box.description,
    box.anonymous_mode,
    box.default_reply_visibility,
    box.status,
    style.tone,
    style.length,
    style.language,
    style.notes,
    box.created_at,
  );
}

export function findBoxByOwner(db: DatabaseSync, ownerId: string): BoxRecord | undefined {
  const row = db.prepare(`SELECT ${BOX_COLUMNS} FROM question_boxes b WHERE b.owner_id = ?`).get(ownerId) as BoxRow | undefined;
  return row ? mapBox(row) : undefined;
}

export function findBoxByIdForOwner(db: DatabaseSync, id: string, ownerId: string): BoxRecord | undefined {
  const row = db
    .prepare(`SELECT ${BOX_COLUMNS} FROM question_boxes b WHERE b.id = ? AND b.owner_id = ?`)
    .get(id, ownerId) as BoxRow | undefined;
  return row ? mapBox(row) : undefined;
}

export function findBoxBySlug(db: DatabaseSync, slug: string): BoxRecord | undefined {
  const row = db
    .prepare(
      `SELECT ${BOX_COLUMNS}, u.display_name AS owner_display_name, u.avatar_url AS owner_avatar_url
       FROM question_boxes b
       JOIN users u ON u.id = b.owner_id
       WHERE b.slug = ? AND u.deleted_at IS NULL`,
    )
    .get(slug) as BoxRow | undefined;
  return row ? mapBox(row) : undefined;
}

export function updateBox(db: DatabaseSync, id: string, patch: Partial<BoxRecord>): void {
  const currentRow = db.prepare(`SELECT ${BOX_COLUMNS} FROM question_boxes b WHERE b.id = ?`).get(id) as BoxRow | undefined;
  if (!currentRow) return;
  const current = mapBox(currentRow);
  const style = { ...current.reply_style, ...patch.reply_style };
  db.prepare(
    `UPDATE question_boxes SET
      slug = ?, title = ?, description = ?, anonymous_mode = ?, default_reply_visibility = ?, status = ?,
      reply_tone = ?, reply_length = ?, reply_language = ?, reply_notes = ?
     WHERE id = ?`,
  ).run(
    patch.slug ?? current.slug,
    patch.title ?? current.title,
    patch.description ?? current.description,
    patch.anonymous_mode ?? current.anonymous_mode,
    patch.default_reply_visibility ?? current.default_reply_visibility,
    patch.status ?? current.status,
    style.tone,
    style.length,
    style.language,
    style.notes,
    id,
  );
}

export function insertQuestion(
  db: DatabaseSync,
  question: QuestionRecord & { idempotencyKey: string; contentHash: string; ipHash: string; viewTokenHash: string },
): void {
  db.prepare(
    `INSERT INTO questions (
      id, box_id, content, asker_display_name, is_anonymous, status, risk_level, submitted_at, deleted_at,
      version, public_consent, view_token_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)`,
  ).run(
    question.id,
    question.box_id,
    question.content,
    question.asker_display_name,
    question.is_anonymous ? 1 : 0,
    question.status,
    question.risk_level,
    question.submitted_at,
    question.public_consent ? 1 : 0,
    question.viewTokenHash,
  );
  db.prepare(
    `INSERT INTO question_idempotency (box_id, idempotency_key, question_id, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(question.box_id, question.idempotencyKey, question.id, question.submitted_at);
  db.prepare(
    `INSERT INTO submission_guards (id, box_id, content_hash, ip_hash, question_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(question.id, question.box_id, question.contentHash, question.ipHash, question.id, question.submitted_at);
}

export function findIdempotentQuestion(db: DatabaseSync, boxId: string, key: string): string | undefined {
  const row = db
    .prepare("SELECT question_id FROM question_idempotency WHERE box_id = ? AND idempotency_key = ?")
    .get(boxId, key) as { question_id: string } | undefined;
  return row?.question_id;
}

export function findRecentDuplicate(db: DatabaseSync, boxId: string, contentHash: string, ipHash: string, since: string): string | undefined {
  const row = db
    .prepare(
      `SELECT question_id FROM submission_guards
       WHERE box_id = ? AND content_hash = ? AND ip_hash = ? AND created_at >= ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(boxId, contentHash, ipHash, since) as { question_id: string } | undefined;
  return row?.question_id;
}

export function pruneGuards(db: DatabaseSync, cutoff: string): void {
  db.prepare("DELETE FROM submission_guards WHERE created_at < ?").run(cutoff);
}

export function findOwnedQuestion(db: DatabaseSync, ownerId: string, questionId: string): QuestionRecord | undefined {
  const row = db
    .prepare(
      `SELECT q.* FROM questions q
       JOIN question_boxes b ON b.id = q.box_id
       WHERE q.id = ? AND b.owner_id = ? AND q.status != 'deleted'`,
    )
    .get(questionId, ownerId) as QuestionRow | undefined;
  return row ? mapQuestion(row) : undefined;
}

export function listQuestions(
  db: DatabaseSync,
  boxId: string,
  filter: { statuses: QuestionStatus[]; q: string },
): { items: QuestionRecord[]; total: number; counts: Partial<Record<QuestionStatus, number>> } {
  const counts: Partial<Record<QuestionStatus, number>> = {};
  const countRows = db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM questions
       WHERE box_id = ? AND status != 'deleted' GROUP BY status`,
    )
    .all(boxId) as Array<{ status: QuestionStatus; n: number | bigint }>;
  for (const row of countRows) counts[row.status] = Number(row.n);

  const where = ["box_id = ?", "status != 'deleted'"];
  const args: Array<string> = [boxId];
  if (filter.statuses.length > 0) {
    where.push(`status IN (${filter.statuses.map(() => "?").join(", ")})`);
    args.push(...filter.statuses);
  }
  if (filter.q) {
    where.push("(instr(lower(content), lower(?)) > 0 OR instr(lower(coalesce(asker_display_name, '')), lower(?)) > 0)");
    args.push(filter.q, filter.q);
  }
  const clause = where.join(" AND ");
  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM questions WHERE ${clause}`).get(...args) as
    | { n: number | bigint }
    | undefined;
  const rows = db
    .prepare(`SELECT * FROM questions WHERE ${clause} ORDER BY submitted_at DESC, rowid DESC LIMIT ${LIST_LIMIT}`)
    .all(...args) as unknown as QuestionRow[];
  return { items: rows.map(mapQuestion), total: Number(totalRow?.n ?? 0), counts };
}

export function updateQuestionState(db: DatabaseSync, id: string, status: QuestionStatus, risk: RiskLevel): boolean {
  const result = db
    .prepare(
      "UPDATE questions SET status = ?, risk_level = ?, version = version + 1 WHERE id = ? AND status != 'deleted' AND deleted_at IS NULL",
    )
    .run(status, risk, id);
  return changed(result) > 0;
}

export function markQuestionDeleted(db: DatabaseSync, id: string, at: string): boolean {
  const result = db
    .prepare(
      "UPDATE questions SET status = 'deleted', deleted_at = ?, version = version + 1 WHERE id = ? AND status != 'deleted'",
    )
    .run(at, id);
  return changed(result) > 0;
}

export function insertGeneration(
  db: DatabaseSync,
  row: GenerationRecord & { ownerId: string },
): void {
  db.prepare(
    `INSERT INTO ai_generations (
      id, question_id, owner_id, provider, model, prompt_version, output, status, created_at,
      input_tokens, output_tokens, latency_ms, error_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.question_id,
    row.ownerId,
    row.provider,
    row.model,
    row.prompt_version,
    row.output,
    row.status,
    row.created_at,
    row.input_tokens ?? null,
    row.output_tokens ?? null,
    row.latency_ms ?? null,
    row.error_code ?? null,
  );
}

export function listGenerations(db: DatabaseSync, questionId: string): GenerationRecord[] {
  const rows = db
    .prepare(
      `SELECT id, question_id, provider, model, prompt_version, output, status, created_at
       FROM ai_generations WHERE question_id = ? AND status = 'completed'
       ORDER BY created_at ASC, rowid ASC`,
    )
    .all(questionId) as unknown as GenerationRecord[];
  return rows;
}

export function hasGeneration(db: DatabaseSync, questionId: string): boolean {
  const row = db.prepare("SELECT 1 AS ok FROM ai_generations WHERE question_id = ? AND status = 'completed' LIMIT 1").get(questionId) as
    | { ok: number }
    | undefined;
  return row !== undefined;
}

export function deleteGeneration(db: DatabaseSync, questionId: string, generationId: string, ownerId: string): boolean {
  const result = db
    .prepare("DELETE FROM ai_generations WHERE id = ? AND question_id = ? AND owner_id = ?")
    .run(generationId, questionId, ownerId);
  return changed(result) > 0;
}

export function findAnswerForQuestion(db: DatabaseSync, questionId: string): AnswerRecord | undefined {
  const row = db.prepare("SELECT * FROM answers WHERE question_id = ?").get(questionId) as AnswerRow | undefined;
  return row ? mapAnswer(row) : undefined;
}

export function findOwnedAnswer(db: DatabaseSync, ownerId: string, answerId: string): (AnswerRecord & { question_status: QuestionStatus }) | undefined {
  const row = db
    .prepare(
      `SELECT a.*, q.status AS question_status
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       JOIN question_boxes b ON b.id = q.box_id
       WHERE a.id = ? AND b.owner_id = ? AND q.status != 'deleted'`,
    )
    .get(answerId, ownerId) as (AnswerRow & { question_status: QuestionStatus }) | undefined;
  if (!row) return undefined;
  return { ...mapAnswer(row), question_status: row.question_status };
}

export function insertAnswer(
  db: DatabaseSync,
  answer: {
    id: string;
    questionId: string;
    content: string;
    visibility: ReplyVisibility;
    source: AnswerSource;
    updatedAt: string;
    revision: number;
  },
): void {
  db.prepare(
    `INSERT INTO answers (
      id, question_id, content, published_content, visibility, source, delivery_state, updated_at, published_at, sent_at,
      confirmed_content, confirmed_at, seen_at, draft_revision
    ) VALUES (?, ?, ?, NULL, ?, ?, 'draft', ?, NULL, NULL, NULL, NULL, NULL, ?)`,
  ).run(answer.id, answer.questionId, answer.content, answer.visibility, answer.source, answer.updatedAt, answer.revision);
}

/**
 * Applies a draft save only when the client revision is newer than the stored one.
 * A missing revision increments in place for callers that are not sequencing saves.
 * Confirmed snapshot columns are intentionally left untouched.
 */
export function updateAnswerDraft(
  db: DatabaseSync,
  id: string,
  patch: { content: string; visibility: ReplyVisibility; source: AnswerSource; updatedAt: string; revision: number | null },
): boolean {
  if (patch.revision === null) {
    const result = db
      .prepare(
        "UPDATE answers SET content = ?, visibility = ?, source = ?, updated_at = ?, draft_revision = draft_revision + 1 WHERE id = ?",
      )
      .run(patch.content, patch.visibility, patch.source, patch.updatedAt, id);
    return changed(result) > 0;
  }
  const result = db
    .prepare(
      `UPDATE answers SET content = ?, visibility = ?, source = ?, updated_at = ?, draft_revision = ?
       WHERE id = ? AND draft_revision < ?`,
    )
    .run(patch.content, patch.visibility, patch.source, patch.updatedAt, patch.revision, id, patch.revision);
  return changed(result) > 0;
}

/**
 * Copies the current draft into the asker-visible snapshot. Does not write a
 * caller-supplied string over a newer draft: the snapshot is the stored content.
 */
export function confirmAnswerSnapshot(
  db: DatabaseSync,
  id: string,
  patch: {
    visibility: ReplyVisibility;
    deliveryState: DeliveryState;
    updatedAt: string;
    publishedAt: string | null;
    sentAt: string | null;
    confirmedAt: string;
    publishSnapshot: boolean;
    expectedRevision: number | null;
  },
): boolean {
  const args: Array<string | number | null> = [
    patch.publishSnapshot ? 1 : 0,
    patch.visibility,
    patch.deliveryState,
    patch.updatedAt,
    patch.publishedAt,
    patch.sentAt,
    patch.confirmedAt,
    id,
  ];
  let revisionSql = "";
  if (patch.expectedRevision !== null) {
    revisionSql = " AND draft_revision = ?";
    args.push(patch.expectedRevision);
  }
  const result = db
    .prepare(
      `UPDATE answers SET
        published_content = CASE WHEN ? = 1 THEN content ELSE NULL END,
        visibility = ?,
        delivery_state = ?,
        updated_at = ?,
        published_at = ?,
        sent_at = ?,
        confirmed_content = content,
        confirmed_at = ?,
        seen_at = CASE
          WHEN confirmed_content IS NOT NULL AND confirmed_content = content THEN seen_at
          ELSE NULL
        END
       WHERE id = ?${revisionSql}`,
    )
    .run(...args);
  return changed(result) > 0;
}

export function listPublicAnswers(db: DatabaseSync, slug: string): Array<{ id: string; question: string; answer: string; published_at: string }> {
  return db
    .prepare(
      `SELECT a.id, q.content AS question, a.published_content AS answer, a.published_at
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       JOIN question_boxes b ON b.id = q.box_id
       WHERE b.slug = ?
         AND a.delivery_state = 'published'
         AND a.published_at IS NOT NULL
         AND a.published_content IS NOT NULL
         AND q.status = 'published'
         AND q.public_consent = 1
       ORDER BY a.published_at DESC`,
    )
    .all(slug) as Array<{ id: string; question: string; answer: string; published_at: string }>;
}

export interface ReplyLinkRecord {
  id: string;
  content: string;
  status: QuestionStatus;
  submitted_at: string;
  deleted_at: string | null;
  box_title: string;
  owner_display_name: string;
  confirmed_content: string | null;
  confirmed_at: string | null;
}

export function findViewTokenHash(db: DatabaseSync, questionId: string): string | null {
  const row = db.prepare("SELECT view_token_hash FROM questions WHERE id = ?").get(questionId) as
    | { view_token_hash: string | null }
    | undefined;
  return row?.view_token_hash ?? null;
}

export function findReplyByTokenHash(db: DatabaseSync, tokenHash: string): ReplyLinkRecord | undefined {
  return db
    .prepare(
      `SELECT q.id, q.content, q.status, q.submitted_at, q.deleted_at,
              b.title AS box_title, u.display_name AS owner_display_name,
              a.confirmed_content, a.confirmed_at
       FROM questions q
       JOIN question_boxes b ON b.id = q.box_id
       JOIN users u ON u.id = b.owner_id AND u.deleted_at IS NULL
       LEFT JOIN answers a ON a.question_id = q.id
       WHERE q.view_token_hash = ?`,
    )
    .get(tokenHash) as ReplyLinkRecord | undefined;
}

export function markReplySeen(db: DatabaseSync, questionId: string, at: string): boolean {
  const result = db
    .prepare(
      `UPDATE answers SET seen_at = ?
       WHERE question_id = ? AND seen_at IS NULL AND confirmed_content IS NOT NULL`,
    )
    .run(at, questionId);
  return changed(result) > 0;
}

export function countBillableGenerations(db: DatabaseSync, ownerId: string, since: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ai_generations
       WHERE owner_id = ? AND created_at >= ?
         AND NOT (status = 'failed' AND error_code = 'aborted')`,
    )
    .get(ownerId, since) as { n: number | bigint } | undefined;
  return Number(row?.n ?? 0);
}

export function pruneInflight(db: DatabaseSync, before: string): void {
  db.prepare("DELETE FROM ai_inflight WHERE started_at < ?").run(before);
}

export function acquireInflight(
  db: DatabaseSync,
  input: { questionId: string; ownerId: string; startedAt: string; staleBefore: string; ownerLimit: number },
): "ok" | "busy" | "owner-limit" {
  let outcome: "ok" | "busy" | "owner-limit" = "ok";
  withTransaction(db, () => {
    pruneInflight(db, input.staleBefore);
    const mine = db.prepare("SELECT COUNT(*) AS n FROM ai_inflight WHERE owner_id = ?").get(input.ownerId) as
      | { n: number | bigint }
      | undefined;
    if (Number(mine?.n ?? 0) >= input.ownerLimit) {
      outcome = "owner-limit";
      return;
    }
    const existing = db.prepare("SELECT 1 AS ok FROM ai_inflight WHERE question_id = ?").get(input.questionId);
    if (existing) {
      outcome = "busy";
      return;
    }
    db.prepare("INSERT INTO ai_inflight (question_id, owner_id, started_at) VALUES (?, ?, ?)").run(
      input.questionId,
      input.ownerId,
      input.startedAt,
    );
  });
  return outcome;
}

export function releaseInflight(db: DatabaseSync, questionId: string): void {
  db.prepare("DELETE FROM ai_inflight WHERE question_id = ?").run(questionId);
}

export type SaveGenerationOutcome =
  | { ok: true; status: QuestionStatus }
  | { ok: false; reason: "deleted" | "archived" | "spam" | "closed" };

const WRITABLE = new Set<string>(AI_WRITABLE_STATUSES);

class GenerationConflict extends Error {
  constructor() {
    super("generation version conflict");
    this.name = "GenerationConflict";
  }
}

/** Inserts a generation only when the question is still writable. Retries one version race. */
export function saveGenerationIfWritable(db: DatabaseSync, row: GenerationRecord & { ownerId: string }): SaveGenerationOutcome {
  const once = (): SaveGenerationOutcome => {
    const gate = db
      .prepare("SELECT status, version, deleted_at FROM questions WHERE id = ?")
      .get(row.question_id) as { status: QuestionStatus; version: number; deleted_at: string | null } | undefined;
    if (!gate || gate.deleted_at || gate.status === "deleted") return { ok: false, reason: "deleted" };
    if (gate.status === "archived") return { ok: false, reason: "archived" };
    if (gate.status === "spam") return { ok: false, reason: "spam" };
    if (!WRITABLE.has(gate.status)) return { ok: false, reason: "closed" };
    insertGeneration(db, row);
    if (gate.status === "submitted" || gate.status === "reviewing") {
      const result = db
        .prepare(
          `UPDATE questions SET status = 'drafted', version = version + 1
           WHERE id = ? AND status = ? AND version = ? AND deleted_at IS NULL`,
        )
        .run(row.question_id, gate.status, gate.version);
      if (changed(result) === 0) throw new GenerationConflict();
      return { ok: true, status: "drafted" };
    }
    return { ok: true, status: gate.status };
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return withTransaction(db, once);
    } catch (error) {
      if (!(error instanceof GenerationConflict)) throw error;
    }
  }
  return { ok: false, reason: "closed" };
}

function mapBox(row: BoxRow): BoxRecord {
  return {
    id: row.id,
    owner_id: row.owner_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    anonymous_mode: row.anonymous_mode,
    default_reply_visibility: row.default_reply_visibility,
    status: row.status,
    reply_style: {
      tone: row.reply_tone,
      length: row.reply_length,
      language: row.reply_language,
      notes: row.reply_notes,
    },
    created_at: row.created_at,
    owner_display_name: row.owner_display_name,
    owner_avatar_url: row.owner_avatar_url,
  };
}

function mapQuestion(row: QuestionRow): QuestionRecord {
  return {
    id: row.id,
    box_id: row.box_id,
    content: row.content,
    asker_display_name: row.asker_display_name,
    is_anonymous: row.is_anonymous === 1,
    status: row.status,
    risk_level: row.risk_level,
    submitted_at: row.submitted_at,
    public_consent: row.public_consent === 1,
  };
}

function mapAnswer(row: AnswerRow): AnswerRecord {
  return {
    id: row.id,
    question_id: row.question_id,
    content: row.content,
    visibility: row.visibility,
    source: row.source,
    delivery_state: row.delivery_state,
    updated_at: row.updated_at,
    published_at: row.published_at,
    sent_at: row.sent_at,
    published_content: row.published_content,
    confirmed_content: row.confirmed_content,
    confirmed_at: row.confirmed_at,
    seen_at: row.seen_at,
    draft_revision: Number(row.draft_revision ?? 0),
  };
}
