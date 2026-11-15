import { ApiError } from "../errors";
import type {
  AiGeneration,
  Answer,
  ApiClient,
  PublicBox,
  Question,
  QuestionBox,
  QuestionStatus,
  Session,
  StatusCounts,
  User,
} from "../types";
import {
  ANSWER_MAX,
  NICKNAME_MAX,
  RESERVED_SLUGS,
  validateQuestion,
  validateSlug,
} from "../../lib/validation";
import { composeMockDraft } from "./draft";
import { createSeed, type MockDb, type StoredUser } from "./seed";

const DB_KEY = "askme:mock-db";
const SESSION_KEY = "askme:mock-session";
const PUBLIC_REPLIES_KEY = "askme:mock-public-replies";
/** Set to "1" in localStorage to make every draft request fail (for exercising error states). */
export const FAIL_AI_KEY = "askme:mock-fail-ai";

const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;

interface MockOptions {
  storage?: Storage;
  latency?: boolean;
  now?: () => number;
}

/**
 * In-browser implementation of ApiClient used until the backend exists.
 * It mirrors the server rules the UI depends on: owner scoping, slug
 * uniqueness, idempotent submission, rate limiting and status transitions.
 */
export function createMockClient(options: MockOptions = {}): ApiClient {
  const storage = options.storage ?? window.localStorage;
  const latency = options.latency ?? true;
  const now = options.now ?? Date.now;
  const submissions = new Map<string, number[]>();

  const iso = () => new Date(now()).toISOString();
  const uid = (prefix: string) =>
    `${prefix}_${now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  function load(): MockDb {
    const raw = storage.getItem(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed.version === 2) return parsed;
      } catch {
        /* fall through to reseed */
      }
    }
    const seeded = createSeed(now());
    save(seeded);
    return seeded;
  }

  function save(db: MockDb) {
    storage.setItem(DB_KEY, JSON.stringify(db));
  }

  async function wait(min = 220, max = 520, signal?: AbortSignal) {
    if (!latency) return;
    const ms = min + Math.random() * (max - min);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new ApiError("aborted", ""));
      });
    });
  }

  function publicUser(user: StoredUser): User {
    const { password: _password, ...rest } = user;
    return rest;
  }

  function sessionFor(db: MockDb, user: StoredUser): Session {
    return { user: publicUser(user), box: db.boxes.find((b) => b.owner_id === user.id) ?? null };
  }

  function requireUser(db: MockDb): StoredUser {
    const id = storage.getItem(SESSION_KEY);
    const user = id ? db.users.find((u) => u.id === id) : undefined;
    if (!user) throw new ApiError("unauthorized", "", { status: 401 });
    return user;
  }

  function requireBox(db: MockDb, user: StoredUser): QuestionBox {
    const box = db.boxes.find((b) => b.owner_id === user.id);
    if (!box) throw new ApiError("not_found", "你还没有创建提问箱。", { status: 404 });
    return box;
  }

  function requireQuestion(db: MockDb, user: StoredUser, id: string): Question {
    const box = requireBox(db, user);
    const question = db.questions.find(
      (q) => q.id === id && q.box_id === box.id && q.status !== "deleted",
    );
    if (!question) throw new ApiError("not_found", "这个问题不存在或已被删除。", { status: 404 });
    return question;
  }

  function requireAnswer(db: MockDb, user: StoredUser, id: string): Answer {
    const answer = db.answers.find((a) => a.id === id);
    if (!answer) throw new ApiError("not_found", "", { status: 404 });
    requireQuestion(db, user, answer.question_id);
    return answer;
  }

  function assertSlugAvailable(db: MockDb, slug: string, exceptBoxId?: string) {
    const error = validateSlug(slug);
    if (error) throw new ApiError("validation", error, { status: 422, fields: { slug: error } });
    if (db.boxes.some((b) => b.slug === slug && b.id !== exceptBoxId)) {
      const message = "这个地址已经被使用了。";
      throw new ApiError("conflict", message, { status: 409, fields: { slug: message } });
    }
  }

  function findPublicBox(db: MockDb, slug: string): QuestionBox {
    const box = db.boxes.find((b) => b.slug === slug.toLowerCase());
    if (!box || RESERVED_SLUGS.has(slug)) throw new ApiError("not_found", "", { status: 404 });
    return box;
  }

  return {
    mode: "mock",

    async getSession() {
      await wait(120, 260);
      const db = load();
      const id = storage.getItem(SESSION_KEY);
      const user = id ? db.users.find((u) => u.id === id) : undefined;
      return user ? sessionFor(db, user) : null;
    },

    async login({ email, password }) {
      await wait(420, 760);
      const db = load();
      const user = db.users.find((u) => u.email === email.trim().toLowerCase());
      if (!user || user.password !== password) {
        throw new ApiError("unauthorized", "邮箱或密码不正确。", { status: 401 });
      }
      storage.setItem(SESSION_KEY, user.id);
      return sessionFor(db, user);
    },

    async register({ email, password, display_name }) {
      await wait(480, 820);
      const db = load();
      const normalized = email.trim().toLowerCase();
      if (db.users.some((u) => u.email === normalized)) {
        const message = "这个邮箱已经注册过了。";
        throw new ApiError("conflict", message, { status: 409, fields: { email: message } });
      }
      const user: StoredUser = {
        id: uid("usr"),
        email: normalized,
        password,
        display_name: display_name.trim(),
        avatar_url: null,
        created_at: iso(),
      };
      db.users.push(user);
      save(db);
      storage.setItem(SESSION_KEY, user.id);
      return sessionFor(db, user);
    },

    async logout() {
      await wait(120, 240);
      storage.removeItem(SESSION_KEY);
    },

    async updateProfile({ display_name }) {
      await wait();
      const db = load();
      const user = requireUser(db);
      user.display_name = display_name.trim();
      save(db);
      return publicUser(user);
    },

    async getPublicBox(slug): Promise<PublicBox> {
      await wait(240, 520);
      const db = load();
      const box = findPublicBox(db, slug);
      const owner = db.users.find((u) => u.id === box.owner_id)!;
      return {
        slug: box.slug,
        title: box.title,
        description: box.description,
        anonymous_mode: box.anonymous_mode,
        accepting: box.status === "active",
        owner: { display_name: owner.display_name, avatar_url: owner.avatar_url },
      };
    },

    async getCapabilities() {
      await wait(80, 120);
      return {
        public_replies_enabled: storage.getItem(PUBLIC_REPLIES_KEY) === "1",
        asker_access: "link" as const,
        notifications: "none" as const,
      };
    },

    async getPublicAnswers(slug) {
      await wait(260, 560);
      if (storage.getItem(PUBLIC_REPLIES_KEY) !== "1") return [];
      const db = load();
      const box = findPublicBox(db, slug);
      return db.answers
        .filter((a) => {
          if (a.visibility !== "public" || !a.published_at || !a.confirmed_content) return false;
          const q = db.questions.find((x) => x.id === a.question_id);
          return q?.box_id === box.id && q.status === "published" && q.public_consent;
        })
        .sort((a, b) => b.published_at!.localeCompare(a.published_at!))
        .map((a) => ({
          id: a.id,
          question: db.questions.find((q) => q.id === a.question_id)!.content,
          answer: a.confirmed_content ?? a.content,
          published_at: a.published_at!,
        }));
    },

    async submitQuestion(slug, input) {
      await wait(520, 900);
      const db = load();
      const box = findPublicBox(db, slug);
      if (box.status !== "active") {
        throw new ApiError("forbidden", "这个提问箱暂时不接收新问题。", { status: 403 });
      }

      if (!input.view_token || input.view_token.length < 43) {
        throw new ApiError("validation", "请重新提交一次。", { status: 422, fields: { view_token: "请重新提交一次。" } });
      }
      const existing = db.idempotency[input.idempotency_key];
      if (existing) {
        if (db.viewTokens[existing] !== input.view_token) {
          throw new ApiError("conflict", "这次重试和原来的提交不一致。请使用第一次提交时保存的查看链接。", { status: 409 });
        }
        return { id: existing };
      }
      const publicEnabled = storage.getItem(PUBLIC_REPLIES_KEY) === "1";
      if (!publicEnabled && input.allow_public) {
        throw new ApiError("forbidden", "公开发布还没有开放，这次没有记录公开授权。", { status: 403 });
      }

      const contentError = validateQuestion(input.content);
      if (contentError) {
        throw new ApiError("validation", contentError, { status: 422, fields: { content: contentError } });
      }
      const nickname = input.asker_display_name?.trim() ?? "";
      const anonymous = box.anonymous_mode === "allowed" && input.is_anonymous;
      if (!anonymous && !nickname) {
        const message = "请留下一个称呼。";
        throw new ApiError("validation", message, { status: 422, fields: { asker_display_name: message } });
      }
      if (nickname.length > NICKNAME_MAX) {
        const message = `称呼最多 ${NICKNAME_MAX} 个字符。`;
        throw new ApiError("validation", message, { status: 422, fields: { asker_display_name: message } });
      }

      const recent = (submissions.get(box.id) ?? []).filter((t) => now() - t < RATE_WINDOW);
      if (recent.length >= RATE_LIMIT) {
        throw new ApiError("rate_limited", "提交得有点频繁，请稍等一会儿再试。", { status: 429 });
      }
      submissions.set(box.id, [...recent, now()]);

      const question: Question = {
        id: uid("q"),
        box_id: box.id,
        content: input.content.trim(),
        asker_display_name: anonymous ? null : nickname,
        is_anonymous: anonymous,
        status: "submitted",
        risk_level: "none",
        submitted_at: iso(),
        public_consent: publicEnabled && input.allow_public === true,
      };
      db.questions.push(question);
      db.idempotency[input.idempotency_key] = question.id;
      db.viewTokens[question.id] = input.view_token;
      save(db);
      return { id: question.id };
    },

    async readReply(token) {
      await wait(200, 400);
      const db = load();
      const questionId = Object.entries(db.viewTokens).find(([, stored]) => stored === token)?.[0];
      if (!questionId) throw new ApiError("not_found", "这个查看链接无效。", { status: 404 });
      const question = db.questions.find((item) => item.id === questionId);
      if (!question || question.status === "deleted") return { state: "deleted" as const };
      const box = db.boxes.find((item) => item.id === question.box_id);
      const owner = db.users.find((item) => item.id === box?.owner_id);
      const answer = db.answers.find((item) => item.question_id === question.id);
      const base = {
        box: { title: box?.title ?? "", owner_display_name: owner?.display_name ?? "" },
        question: { content: question.content, submitted_at: question.submitted_at },
      };
      if (!answer?.confirmed_content || !answer.confirmed_at) {
        return { state: "pending" as const, ...base, reply: null };
      }
      if (!answer.seen_at) answer.seen_at = iso();
      save(db);
      return {
        state: "confirmed" as const,
        ...base,
        reply: { content: answer.confirmed_content, confirmed_at: answer.confirmed_at },
      };
    },

    async createBox(input) {
      await wait(480, 800);
      const db = load();
      const user = requireUser(db);
      if (db.boxes.some((b) => b.owner_id === user.id)) {
        throw new ApiError("conflict", "你已经有一个提问箱了。", { status: 409 });
      }
      assertSlugAvailable(db, input.slug);
      const box: QuestionBox = { ...input, id: uid("box"), owner_id: user.id, created_at: iso() };
      db.boxes.push(box);
      save(db);
      return box;
    },

    async updateBox(id, input) {
      await wait(360, 640);
      const db = load();
      const user = requireUser(db);
      const box = db.boxes.find((b) => b.id === id && b.owner_id === user.id);
      if (!box) throw new ApiError("not_found", "", { status: 404 });
      if (input.slug !== undefined && input.slug !== box.slug) assertSlugAvailable(db, input.slug, box.id);
      Object.assign(box, input);
      save(db);
      return box;
    },

    async listQuestions({ status, q }) {
      await wait(260, 520);
      const db = load();
      const user = requireUser(db);
      const box = requireBox(db, user);
      const owned = db.questions.filter((x) => x.box_id === box.id && x.status !== "deleted");

      const counts: StatusCounts = {};
      for (const question of owned) counts[question.status] = (counts[question.status] ?? 0) + 1;

      const needle = q?.trim().toLowerCase();
      const items = owned
        .filter((x) => !status?.length || status.includes(x.status))
        .filter(
          (x) =>
            !needle ||
            x.content.toLowerCase().includes(needle) ||
            x.asker_display_name?.toLowerCase().includes(needle),
        )
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

      return { items, total: items.length, counts };
    },

    async getQuestion(id) {
      await wait(200, 420);
      const db = load();
      const user = requireUser(db);
      const question = requireQuestion(db, user, id);
      return {
        question,
        answer: db.answers.find((a) => a.question_id === id) ?? null,
        generations: db.generations
          .filter((g) => g.question_id === id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      };
    },

    async updateQuestionStatus(id, status: QuestionStatus) {
      await wait(180, 360);
      const db = load();
      const user = requireUser(db);
      const question = requireQuestion(db, user, id);
      question.status = status;
      question.risk_level = status === "flagged" ? "review" : question.risk_level;
      save(db);
      return question;
    },

    async deleteQuestion(id) {
      await wait(240, 420);
      const db = load();
      const user = requireUser(db);
      requireQuestion(db, user, id).status = "deleted";
      save(db);
    },

    async generateDraft(questionId, signal) {
      await wait(1400, 2400, signal);
      const db = load();
      const user = requireUser(db);
      const question = requireQuestion(db, user, questionId);
      if (storage.getItem(FAIL_AI_KEY) === "1") {
        throw new ApiError("server", "草稿生成失败，模型暂时没有响应。", { status: 503 });
      }
      const box = requireBox(db, user);
      const generation: AiGeneration = {
        id: uid("gen"),
        question_id: questionId,
        provider: "local",
        model: "mock-draft-v1",
        prompt_version: "2026-11",
        output: composeMockDraft(question.content, box.reply_style),
        status: "completed",
        created_at: iso(),
      };
      db.generations.push(generation);
      if (question.status === "submitted" || question.status === "reviewing") question.status = "drafted";
      save(db);
      return generation;
    },

    async deleteDraft(questionId, generationId) {
      await wait(160, 300);
      const db = load();
      const user = requireUser(db);
      requireQuestion(db, user, questionId);
      db.generations = db.generations.filter(
        (g) => !(g.id === generationId && g.question_id === questionId),
      );
      save(db);
    },

    async saveAnswer(questionId, input) {
      await wait(320, 560);
      const db = load();
      const user = requireUser(db);
      const question = requireQuestion(db, user, questionId);
      assertAnswer(input.content);
      let answer = db.answers.find((a) => a.question_id === questionId);
      if (answer) {
        if (input.draft_revision !== undefined && input.draft_revision <= answer.draft_revision) {
          save(db);
          return answer;
        }
        answer.content = input.content;
        answer.visibility = input.visibility;
        answer.source = input.source;
        answer.updated_at = iso();
        answer.draft_revision = input.draft_revision ?? answer.draft_revision + 1;
      } else {
        answer = {
          id: uid("ans"),
          question_id: questionId,
          content: input.content,
          visibility: input.visibility,
          source: input.source,
          updated_at: iso(),
          published_at: null,
          sent_at: null,
          delivery_state: "draft",
          confirmed_content: null,
          confirmed_at: null,
          seen_at: null,
          draft_revision: input.draft_revision ?? 1,
        };
        db.answers.push(answer);
      }
      if (question.status === "submitted" || question.status === "reviewing") question.status = "drafted";
      save(db);
      return answer;
    },

    async updateAnswer(answerId, input) {
      await wait(320, 560);
      const db = load();
      const user = requireUser(db);
      const answer = requireAnswer(db, user, answerId);
      if (input.content !== undefined) assertAnswer(input.content);
      if (input.draft_revision !== undefined && input.draft_revision <= answer.draft_revision) {
        return answer;
      }
      if (input.content !== undefined) answer.content = input.content;
      if (input.visibility !== undefined) answer.visibility = input.visibility;
      if (input.source !== undefined) answer.source = input.source;
      answer.updated_at = iso();
      answer.draft_revision = input.draft_revision ?? answer.draft_revision + 1;
      save(db);
      return answer;
    },

    async publishAnswer(answerId, visibility, draftRevision) {
      await wait(520, 860);
      const db = load();
      const user = requireUser(db);
      const answer = requireAnswer(db, user, answerId);
      const question = requireQuestion(db, user, answer.question_id);
      if (question.status === "spam") {
        throw new ApiError("conflict", "这个问题被标记为垃圾，移回收件箱后才能回复。", { status: 409 });
      }
      if (draftRevision !== undefined && draftRevision !== answer.draft_revision) {
        throw new ApiError("conflict", "回复内容刚更新过，请再确认一次。", { status: 409 });
      }
      if (visibility === "public") {
        if (storage.getItem(PUBLIC_REPLIES_KEY) !== "1") {
          throw new ApiError("forbidden", "公开发布还没有开放，这次没有公开。", { status: 403 });
        }
        if (!question.public_consent) {
          throw new ApiError("forbidden", "提问者没有同意公开，不能发布到提问页。", { status: 403 });
        }
        answer.visibility = "public";
        answer.published_at = iso();
        answer.sent_at = null;
        answer.delivery_state = "published";
        question.status = "published";
      } else {
        answer.visibility = "private";
        answer.sent_at = iso();
        answer.published_at = null;
        answer.delivery_state = "private_reserved";
        question.status = "answered_private";
      }
      const same = answer.confirmed_content === answer.content;
      answer.confirmed_content = answer.content;
      answer.confirmed_at = iso();
      if (!same) answer.seen_at = null;
      answer.updated_at = iso();
      save(db);
      return answer;
    },
  };
}

function assertAnswer(content: string) {
  if (!content.trim()) {
    throw new ApiError("validation", "回复内容不能为空。", { status: 422, fields: { content: "回复内容不能为空。" } });
  }
  if (content.length > ANSWER_MAX) {
    const message = `回复最多 ${ANSWER_MAX} 字。`;
    throw new ApiError("validation", message, { status: 422, fields: { content: message } });
  }
}
