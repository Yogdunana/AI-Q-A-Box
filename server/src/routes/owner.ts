import type { FastifyInstance } from "fastify";
import { PROMPT_VERSION, type ReplyStyle } from "../constants.ts";
import { writeAudit } from "../audit.ts";
import { AiAborted, AiFailure } from "../ai/index.ts";
import type { AppContext } from "../context.ts";
import { iso } from "../context.ts";
import { newId } from "../crypto.ts";
import { assertStatusPatch, decideDelivery, statusAfterDraft } from "../delivery.ts";
import { isUniqueConstraint, withTransaction } from "../db.ts";
import { conflict, notFound, unavailable, validation } from "../errors.ts";
import { noContent, param, queryString, requireUser } from "../http.ts";
import { answerJson, boxJson, generationJson, questionJson } from "../present.ts";
import { consume } from "../rate-limit.ts";
import { isHighRisk, localReviewDraft } from "../risk.ts";
import {
  deleteGeneration,
  findAnswerForQuestion,
  findBoxByIdForOwner,
  findBoxByOwner,
  findOwnedAnswer,
  findOwnedQuestion,
  hasGeneration,
  insertAnswer,
  insertBox,
  insertGeneration,
  listGenerations,
  listQuestions,
  updateAnswerDelivery,
  updateAnswerDraft,
  updateBox,
  updateQuestionState,
  markQuestionDeleted,
  type BoxRecord,
} from "../store.ts";
import { parseAnswer, parseBox, parseListQuery, parsePublish, parseStatusPatch } from "../validate.ts";

const SPAM = "这个问题被标记为垃圾，移回收件箱后才能回复。";
const MISSING_QUESTION = "这个问题不存在或已被删除。";
const MISSING_BOX = "你还没有创建提问箱。";

export function registerOwnerRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/me/boxes", async (request) => {
    const user = requireUser(ctx, request);
    if (findBoxByOwner(ctx.db, user.id)) throw conflict("你已经有一个提问箱了。");
    const input = parseBox(request.body, "create");
    const now = iso(ctx);
    const box: BoxRecord = {
      id: newId(),
      owner_id: user.id,
      slug: input.slug ?? "",
      title: input.title ?? "",
      description: input.description ?? "",
      anonymous_mode: input.anonymous_mode ?? "allowed",
      default_reply_visibility: input.default_reply_visibility ?? "private",
      status: input.status ?? "active",
      reply_style: completeStyle(input.reply_style),
      created_at: now,
    };
    try {
      withTransaction(ctx.db, () => {
        insertBox(ctx.db, box);
        writeAudit(ctx.db, {
          actorId: user.id,
          action: "box.create",
          resourceType: "box",
          resourceId: box.id,
          metadata: { slug: box.slug },
          createdAt: now,
        });
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw boxConflict(error);
      throw error;
    }
    return boxJson(box);
  });

  app.patch("/api/me/boxes/:id", async (request) => {
    const user = requireUser(ctx, request);
    const box = findBoxByIdForOwner(ctx.db, param(request, "id"), user.id);
    if (!box) throw notFound();
    const input = parseBox(request.body, "patch");
    const patch: Partial<BoxRecord> = {};
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.anonymous_mode !== undefined) patch.anonymous_mode = input.anonymous_mode;
    if (input.default_reply_visibility !== undefined) patch.default_reply_visibility = input.default_reply_visibility;
    if (input.status !== undefined) patch.status = input.status;
    if (input.reply_style) patch.reply_style = { ...box.reply_style, ...input.reply_style };
    try {
      withTransaction(ctx.db, () => {
        updateBox(ctx.db, box.id, patch);
        writeAudit(ctx.db, {
          actorId: user.id,
          action: "box.update",
          resourceType: "box",
          resourceId: box.id,
          createdAt: iso(ctx),
        });
      });
    } catch (error) {
      if (isUniqueConstraint(error)) throw boxConflict(error);
      throw error;
    }
    const updated = findBoxByIdForOwner(ctx.db, box.id, user.id);
    if (!updated) throw notFound();
    return boxJson(updated);
  });

  app.get("/api/me/questions", async (request) => {
    const box = requireBox(ctx, request);
    const filter = parseListQuery(queryString(request, "status"), queryString(request, "q"));
    const list = listQuestions(ctx.db, box.id, filter);
    return { items: list.items.map(questionJson), total: list.total, counts: list.counts };
  });

  app.get("/api/me/questions/:id", async (request) => {
    const user = requireUser(ctx, request);
    const question = findOwnedQuestion(ctx.db, user.id, param(request, "id"));
    if (!question) throw notFound(MISSING_QUESTION);
    return {
      question: questionJson(question),
      answer: optionalAnswer(ctx, question.id),
      generations: listGenerations(ctx.db, question.id).map(generationJson),
    };
  });

  app.patch("/api/me/questions/:id", async (request) => {
    const user = requireUser(ctx, request);
    const question = findOwnedQuestion(ctx.db, user.id, param(request, "id"));
    if (!question) throw notFound(MISSING_QUESTION);
    const next = parseStatusPatch(request.body);
    const answer = findAnswerForQuestion(ctx.db, question.id);
    assertStatusPatch({ next, answer: answer ?? null, hasDraft: hasGeneration(ctx.db, question.id) });
    const risk = next === "flagged" ? "review" : question.risk_level;
    withTransaction(ctx.db, () => {
      updateQuestionState(ctx.db, question.id, next, risk);
      writeAudit(ctx.db, {
        actorId: user.id,
        action: "question.status",
        resourceType: "question",
        resourceId: question.id,
        metadata: { from: question.status, to: next },
        createdAt: iso(ctx),
      });
    });
    return questionJson({ ...question, status: next, risk_level: risk });
  });

  app.delete("/api/me/questions/:id", async (request, reply) => {
    const user = requireUser(ctx, request);
    const question = findOwnedQuestion(ctx.db, user.id, param(request, "id"));
    if (!question) throw notFound(MISSING_QUESTION);
    withTransaction(ctx.db, () => {
      markQuestionDeleted(ctx.db, question.id, iso(ctx));
      writeAudit(ctx.db, {
        actorId: user.id,
        action: "question.delete",
        resourceType: "question",
        resourceId: question.id,
        createdAt: iso(ctx),
      });
    });
    return noContent(reply);
  });

  app.post("/api/me/questions/:id/ai-drafts", async (request, reply) => {
    const user = requireUser(ctx, request);
    const question = findOwnedQuestion(ctx.db, user.id, param(request, "id"));
    if (!question) throw notFound(MISSING_QUESTION);
    if (question.status === "spam") throw conflict(SPAM);
    const box = findBoxByOwner(ctx.db, user.id);
    if (!box) throw notFound(MISSING_BOX);
    consume(ctx, `ai:${user.id}`, ctx.config.aiRateLimit, ctx.config.aiRateWindowMs);

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.raw.on("aborted", onAbort);
    let output = "";
    let provider = ctx.ai.provider;
    let model = ctx.ai.model;
    try {
      if (isHighRisk(question.content)) {
        output = localReviewDraft();
        provider = "local-safety";
        model = "review-template";
      } else {
        output = await ctx.ai.generate({ question: question.content, style: box.reply_style }, controller.signal);
      }
    } catch (error) {
      writeAudit(ctx.db, {
        actorId: user.id,
        action: "ai.draft_failed",
        resourceType: "question",
        resourceId: question.id,
        metadata: { provider },
        createdAt: iso(ctx),
      });
      if (error instanceof AiAborted) return reply.code(499).send({ message: "操作已取消。" });
      if (!(error instanceof AiFailure)) request.log.warn({ questionId: question.id }, "ai draft failed");
      throw unavailable("草稿生成失败，模型暂时没有响应。");
    } finally {
      request.raw.removeListener("aborted", onAbort);
    }

    const now = iso(ctx);
    const generation = {
      id: newId(),
      question_id: question.id,
      provider,
      model,
      prompt_version: PROMPT_VERSION,
      output,
      status: "completed" as const,
      created_at: now,
    };
    const status = statusAfterDraft(question.status);
    withTransaction(ctx.db, () => {
      insertGeneration(ctx.db, { ...generation, ownerId: user.id });
      if (status !== question.status) updateQuestionState(ctx.db, question.id, status, question.risk_level);
      writeAudit(ctx.db, {
        actorId: user.id,
        action: "ai.draft",
        resourceType: "generation",
        resourceId: generation.id,
        metadata: { provider, model },
        createdAt: now,
      });
    });
    return generationJson(generation);
  });

  app.delete("/api/me/questions/:id/ai-drafts/:generationId", async (request, reply) => {
    const user = requireUser(ctx, request);
    const question = findOwnedQuestion(ctx.db, user.id, param(request, "id"));
    if (!question) throw notFound(MISSING_QUESTION);
    const removed = deleteGeneration(ctx.db, question.id, param(request, "generationId"), user.id);
    if (!removed) throw notFound();
    writeAudit(ctx.db, {
      actorId: user.id,
      action: "ai.draft_delete",
      resourceType: "generation",
      resourceId: param(request, "generationId"),
      createdAt: iso(ctx),
    });
    return noContent(reply);
  });

  app.post("/api/me/questions/:id/answers", async (request) => {
    const user = requireUser(ctx, request);
    const question = findOwnedQuestion(ctx.db, user.id, param(request, "id"));
    if (!question) throw notFound(MISSING_QUESTION);
    if (question.status === "spam") throw conflict(SPAM);
    const input = parseAnswer(request.body, "create");
    const existing = findAnswerForQuestion(ctx.db, question.id);
    const now = iso(ctx);
    const content = input.content ?? existing?.content ?? "";
    const visibility = input.visibility ?? existing?.visibility ?? "private";
    const source = input.source ?? existing?.source ?? "human";
    const id = existing?.id ?? newId();
    const status = statusAfterDraft(question.status);
    withTransaction(ctx.db, () => {
      if (existing) updateAnswerDraft(ctx.db, existing.id, { content, visibility, source, updatedAt: now });
      else insertAnswer(ctx.db, { id, questionId: question.id, content, visibility, source, updatedAt: now });
      if (status !== question.status) updateQuestionState(ctx.db, question.id, status, question.risk_level);
      writeAudit(ctx.db, {
        actorId: user.id,
        action: "answer.save",
        resourceType: "answer",
        resourceId: id,
        metadata: { state: "draft" },
        createdAt: now,
      });
    });
    const saved = findAnswerForQuestion(ctx.db, question.id);
    if (!saved) throw notFound();
    return answerJson(saved);
  });

  app.patch("/api/me/answers/:id", async (request) => {
    const user = requireUser(ctx, request);
    const answer = findOwnedAnswer(ctx.db, user.id, param(request, "id"));
    if (!answer) throw notFound();
    if (answer.question_status === "spam") throw conflict(SPAM);
    const input = parseAnswer(request.body, "patch");
    const now = iso(ctx);
    updateAnswerDraft(ctx.db, answer.id, {
      content: input.content ?? answer.content,
      visibility: input.visibility ?? answer.visibility,
      source: input.source ?? answer.source,
      updatedAt: now,
    });
    writeAudit(ctx.db, {
      actorId: user.id,
      action: "answer.save",
      resourceType: "answer",
      resourceId: answer.id,
      metadata: { state: answer.delivery_state },
      createdAt: now,
    });
    const saved = findAnswerForQuestion(ctx.db, answer.question_id);
    if (!saved) throw notFound();
    return answerJson(saved);
  });

  app.post("/api/me/answers/:id/publish", async (request) => {
    const user = requireUser(ctx, request);
    const answer = findOwnedAnswer(ctx.db, user.id, param(request, "id"));
    if (!answer) throw notFound();
    if (answer.question_status === "spam") throw conflict(SPAM);
    const visibility = parsePublish(request.body);
    const question = findOwnedQuestion(ctx.db, user.id, answer.question_id);
    if (!question) throw notFound(MISSING_QUESTION);
    const decision = decideDelivery({
      visibility,
      content: answer.content,
      now: iso(ctx),
      publicRepliesEnabled: ctx.config.publicRepliesEnabled,
    });
    withTransaction(ctx.db, () => {
      updateAnswerDelivery(ctx.db, answer.id, {
        content: answer.content,
        publishedContent: decision.published_content,
        visibility: decision.visibility,
        deliveryState: decision.delivery_state,
        updatedAt: decision.published_at ?? decision.sent_at ?? iso(ctx),
        publishedAt: decision.published_at,
        sentAt: decision.sent_at,
      });
      updateQuestionState(ctx.db, answer.question_id, decision.question_status, question.risk_level);
      writeAudit(ctx.db, {
        actorId: user.id,
        action: decision.delivery_state === "published" ? "answer.publish" : "answer.private_reserve",
        resourceType: "answer",
        resourceId: answer.id,
        metadata: { state: decision.delivery_state },
        createdAt: decision.published_at ?? decision.sent_at ?? iso(ctx),
      });
    });
    const saved = findAnswerForQuestion(ctx.db, answer.question_id);
    if (!saved) throw notFound();
    return answerJson(saved);
  });
}

function requireBox(ctx: AppContext, request: Parameters<typeof requireUser>[1]) {
  const user = requireUser(ctx, request);
  const box = findBoxByOwner(ctx.db, user.id);
  if (!box) throw notFound(MISSING_BOX);
  return box;
}

function optionalAnswer(ctx: AppContext, questionId: string) {
  const answer = findAnswerForQuestion(ctx.db, questionId);
  return answer ? answerJson(answer) : null;
}

function completeStyle(style: Partial<ReplyStyle> | undefined): ReplyStyle {
  if (!style?.tone || !style.length || !style.language || style.notes === undefined) {
    throw validation({ reply_style: "请设置回复风格。" });
  }
  return { tone: style.tone, length: style.length, language: style.language, notes: style.notes };
}

function boxConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("question_boxes.slug")) {
    throw conflict("这个地址已经被使用了。", { slug: "这个地址已经被使用了。" });
  }
  throw conflict("你已经有一个提问箱了。");
}
