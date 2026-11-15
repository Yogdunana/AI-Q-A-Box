import type { FastifyInstance } from "fastify";
import { AI_WRITABLE_STATUSES, PROMPT_VERSION, type ReplyStyle } from "../constants.ts";
import { writeAudit } from "../audit.ts";
import { AiAborted, AiFailure, maxOutputTokens } from "../ai/index.ts";
import type { AppContext } from "../context.ts";
import { iso } from "../context.ts";
import { newId } from "../crypto.ts";
import { assertStatusPatch, decideDelivery, statusAfterDraft } from "../delivery.ts";
import { isUniqueConstraint, withTransaction } from "../db.ts";
import { conflict, notFound, rateLimited, unavailable, validation } from "../errors.ts";
import { abortWhenClientLeaves, noContent, param, queryString, requireUser } from "../http.ts";
import { answerJson, boxJson, generationJson, questionJson } from "../present.ts";
import { consume } from "../rate-limit.ts";
import { isHighRisk, localReviewDraft } from "../risk.ts";
import {
  acquireInflight,
  confirmAnswerSnapshot,
  countBillableGenerations,
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
  releaseInflight,
  saveGenerationIfWritable,
  updateAnswerDraft,
  updateBox,
  updateQuestionState,
  markQuestionDeleted,
  type BoxRecord,
  type GenerationRecord,
} from "../store.ts";
import { parseAnswer, parseBox, parseListQuery, parsePublish, parseStatusPatch } from "../validate.ts";

const SPAM = "这个问题被标记为垃圾，移回收件箱后才能回复。";
const ARCHIVED = "这个问题已归档。移回收件箱后才能继续处理。";
const MISSING_QUESTION = "这个问题不存在或已被删除。";
const MISSING_BOX = "你还没有创建提问箱。";
const WRITABLE = new Set<string>(AI_WRITABLE_STATUSES);

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
    const updated = updateQuestionState(ctx.db, question.id, next, risk);
    if (!updated) throw notFound(MISSING_QUESTION);
    withTransaction(ctx.db, () => {
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
    if (question.status === "archived") throw conflict(ARCHIVED);
    if (!WRITABLE.has(question.status)) throw conflict("这个问题现在不能生成草稿。");
    const box = findBoxByOwner(ctx.db, user.id);
    if (!box) throw notFound(MISSING_BOX);
    consume(ctx, `ai:${user.id}`, ctx.config.aiRateLimit, ctx.config.aiRateWindowMs);
    const dayStart = utcDayStart(ctx.now());
    if (countBillableGenerations(ctx.db, user.id, dayStart) >= ctx.config.aiDailyLimit) {
      throw rateLimited("今天的草稿生成次数已经用完。");
    }
    const startedAt = iso(ctx);
    const slot = acquireInflight(ctx.db, {
      questionId: question.id,
      ownerId: user.id,
      startedAt,
      staleBefore: new Date(ctx.now() - ctx.config.aiTimeoutMs - 15_000).toISOString(),
      ownerLimit: ctx.config.aiMaxConcurrent,
    });
    if (slot === "busy") throw conflict("正在生成这条问题的草稿。");
    if (slot === "owner-limit") throw rateLimited("已有草稿正在生成，请等它完成后再试。");

    const disconnect = abortWhenClientLeaves(request, reply);
    const startedMs = ctx.now();
    let text = "";
    let provider = ctx.ai.provider;
    let model = ctx.ai.model;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    try {
      if (isHighRisk(question.content)) {
        text = localReviewDraft();
        provider = "local-safety";
        model = "review-template";
      } else {
        const generated = await ctx.ai.generate(
          {
            question: question.content,
            style: box.reply_style,
            maxOutputTokens: maxOutputTokens(box.reply_style.length, ctx.config.aiMaxOutputTokens),
          },
          disconnect.signal,
        );
        text = generated.text;
        inputTokens = generated.inputTokens;
        outputTokens = generated.outputTokens;
      }
    } catch (error) {
      const errorCode = error instanceof AiAborted || disconnect.signal.aborted ? "aborted" : "upstream";
      recordGenerationFailure(ctx, {
        questionId: question.id,
        ownerId: user.id,
        provider,
        model,
        errorCode,
        inputTokens,
        outputTokens,
        latencyMs: Math.max(0, ctx.now() - startedMs),
      });
      if (errorCode === "aborted") return reply.code(499).send({ message: "操作已取消。" });
      if (!(error instanceof AiFailure)) request.log.warn({ questionId: question.id, errorCode }, "ai draft failed");
      throw unavailable("草稿生成失败，模型暂时没有响应。");
    } finally {
      disconnect.stop();
      releaseInflight(ctx.db, question.id);
    }

    const now = iso(ctx);
    const generation: GenerationRecord = {
      id: newId(),
      question_id: question.id,
      provider,
      model,
      prompt_version: PROMPT_VERSION,
      output: text,
      status: "completed",
      created_at: now,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: Math.max(0, ctx.now() - startedMs),
      error_code: null,
    };
    const saved = saveGenerationIfWritable(ctx.db, { ...generation, ownerId: user.id });
    if (!saved.ok) {
      recordGenerationFailure(ctx, {
        questionId: question.id,
        ownerId: user.id,
        provider,
        model,
        errorCode: `discarded_${saved.reason}`,
        inputTokens,
        outputTokens,
        latencyMs: generation.latency_ms ?? 0,
      });
      if (saved.reason === "deleted") throw notFound(MISSING_QUESTION);
      throw conflict(discardedMessage(saved.reason));
    }
    writeAudit(ctx.db, {
      actorId: user.id,
      action: "ai.draft",
      resourceType: "generation",
      resourceId: generation.id,
      metadata: {
        provider,
        model,
        usage_in: inputTokens ?? 0,
        usage_out: outputTokens ?? 0,
      },
      createdAt: now,
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
    let applied = true;
    withTransaction(ctx.db, () => {
      if (existing) {
        applied = updateAnswerDraft(ctx.db, existing.id, {
          content,
          visibility,
          source,
          updatedAt: now,
          revision: input.draft_revision,
        });
      } else {
        insertAnswer(ctx.db, {
          id,
          questionId: question.id,
          content,
          visibility,
          source,
          updatedAt: now,
          revision: input.draft_revision ?? 1,
        });
      }
      if (applied && status !== question.status) updateQuestionState(ctx.db, question.id, status, question.risk_level);
      if (applied) {
        writeAudit(ctx.db, {
          actorId: user.id,
          action: "answer.save",
          resourceType: "answer",
          resourceId: id,
          metadata: { state: "draft" },
          createdAt: now,
        });
      }
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
    const applied = updateAnswerDraft(ctx.db, answer.id, {
      content: input.content ?? answer.content,
      visibility: input.visibility ?? answer.visibility,
      source: input.source ?? answer.source,
      updatedAt: now,
      revision: input.draft_revision,
    });
    if (applied) {
      writeAudit(ctx.db, {
        actorId: user.id,
        action: "answer.save",
        resourceType: "answer",
        resourceId: answer.id,
        metadata: { state: answer.delivery_state },
        createdAt: now,
      });
    }
    const saved = findAnswerForQuestion(ctx.db, answer.question_id);
    if (!saved) throw notFound();
    return answerJson(saved);
  });

  app.post("/api/me/answers/:id/publish", async (request) => {
    const user = requireUser(ctx, request);
    const answer = findOwnedAnswer(ctx.db, user.id, param(request, "id"));
    if (!answer) throw notFound();
    if (answer.question_status === "spam") throw conflict(SPAM);
    if (answer.question_status === "archived") throw conflict(ARCHIVED);
    const publication = parsePublish(request.body);
    const question = findOwnedQuestion(ctx.db, user.id, answer.question_id);
    if (!question) throw notFound(MISSING_QUESTION);
    const now = iso(ctx);
    const decision = decideDelivery({
      visibility: publication.visibility,
      content: answer.content,
      now,
      publicRepliesEnabled: ctx.config.publicRepliesEnabled,
      publicConsent: question.public_consent,
    });
    let confirmed = false;
    withTransaction(ctx.db, () => {
      confirmed = confirmAnswerSnapshot(ctx.db, answer.id, {
        visibility: decision.visibility,
        deliveryState: decision.delivery_state,
        updatedAt: now,
        publishedAt: decision.published_at,
        sentAt: decision.sent_at,
        confirmedAt: decision.confirmed_at,
        publishSnapshot: decision.delivery_state === "published",
        expectedRevision: publication.draft_revision,
      });
      if (!confirmed) return;
      const statusUpdated = updateQuestionState(ctx.db, answer.question_id, decision.question_status, question.risk_level);
      if (!statusUpdated) throw notFound(MISSING_QUESTION);
      writeAudit(ctx.db, {
        actorId: user.id,
        action: decision.delivery_state === "published" ? "answer.publish" : "answer.private_reserve",
        resourceType: "answer",
        resourceId: answer.id,
        metadata: { state: decision.delivery_state },
        createdAt: now,
      });
    });
    if (!confirmed) throw conflict("回复内容刚更新过，请再确认一次。");
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

function recordGenerationFailure(
  ctx: AppContext,
  input: {
    questionId: string;
    ownerId: string;
    provider: string;
    model: string;
    errorCode: string;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
  },
): void {
  const now = iso(ctx);
  const id = newId();
  insertGeneration(ctx.db, {
    id,
    question_id: input.questionId,
    ownerId: input.ownerId,
    provider: input.provider,
    model: input.model,
    prompt_version: PROMPT_VERSION,
    output: "",
    status: "failed",
    created_at: now,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    latency_ms: input.latencyMs,
    error_code: input.errorCode,
  });
  writeAudit(ctx.db, {
    actorId: input.ownerId,
    action: "ai.draft_failed",
    resourceType: "question",
    resourceId: input.questionId,
    metadata: { provider: input.provider, error_code: input.errorCode },
    createdAt: now,
  });
}

function discardedMessage(reason: "archived" | "spam" | "closed"): string {
  if (reason === "archived") return "问题已归档，这次生成的草稿没有保存。";
  if (reason === "spam") return "问题已被标记为垃圾，这次生成的草稿没有保存。";
  return "问题状态已经变化，这次生成的草稿没有保存。";
}

function utcDayStart(ms: number): string {
  const date = new Date(ms);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

function boxConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("question_boxes.slug")) {
    throw conflict("这个地址已经被使用了。", { slug: "这个地址已经被使用了。" });
  }
  throw conflict("你已经有一个提问箱了。");
}
