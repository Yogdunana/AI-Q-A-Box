import type { FastifyInstance } from "fastify";
import { writeAudit } from "../audit.ts";
import type { AppContext } from "../context.ts";
import { iso } from "../context.ts";
import { contentHash, hashToken, hashesMatch, newId } from "../crypto.ts";
import { isUniqueConstraint, withTransaction } from "../db.ts";
import { conflict, forbidden, notFound } from "../errors.ts";
import { clientHash } from "../http.ts";
import { param } from "../http.ts";
import { publicBoxJson } from "../present.ts";
import { consume } from "../rate-limit.ts";
import { isHighRisk } from "../risk.ts";
import {
  findBoxBySlug,
  findIdempotentQuestion,
  findRecentDuplicate,
  findViewTokenHash,
  insertQuestion,
  listPublicAnswers,
  pruneGuards,
} from "../store.ts";
import { nicknameRequired, parseSubmit, slugProblem } from "../validate.ts";

const SUBMIT_LIMIT = "提交得有点频繁，请稍等一会儿再试。";

export function registerPublicRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/boxes/:slug", async (request) => {
    consume(ctx, `read:${clientHash(ctx, request)}`, ctx.config.publicReadRateLimit, ctx.config.publicReadRateWindowMs);
    return publicBoxJson(loadPublicBox(ctx, param(request, "slug")));
  });

  app.get("/api/boxes/:slug/answers", async (request) => {
    consume(ctx, `read:${clientHash(ctx, request)}`, ctx.config.publicReadRateLimit, ctx.config.publicReadRateWindowMs);
    const box = loadPublicBox(ctx, param(request, "slug"));
    if (!ctx.config.publicRepliesEnabled) return [];
    return listPublicAnswers(ctx.db, box.slug);
  });

  app.post("/api/boxes/:slug/questions", async (request) => {
    const box = loadPublicBox(ctx, param(request, "slug"));
    if (box.status !== "active") throw forbidden("这个提问箱暂时不接收新问题。");
    const input = parseSubmit(request.body);
    const replay = findIdempotentQuestion(ctx.db, box.id, input.idempotency_key);
    if (replay) return replayOwned(ctx, replay, input.view_token);

    if (input.allow_public && !ctx.config.publicRepliesEnabled) {
      throw forbidden("公开发布还没有开放，这次没有记录公开授权。");
    }

    consume(ctx, `submit:${box.id}:${clientHash(ctx, request)}`, ctx.config.submitRateLimit, ctx.config.submitRateWindowMs, SUBMIT_LIMIT);
    const anonymous = box.anonymous_mode === "allowed" && input.is_anonymous;
    if (!anonymous && !input.asker_display_name) throw nicknameRequired();

    const hash = contentHash(input.content);
    const ipHash = clientHash(ctx, request);
    if (ctx.config.dedupeWindowMs > 0) {
      const since = new Date(ctx.now() - ctx.config.dedupeWindowMs).toISOString();
      const duplicate = findRecentDuplicate(ctx.db, box.id, hash, ipHash, since);
      if (duplicate) {
        if (ownsViewToken(ctx, duplicate, input.view_token)) return { id: duplicate };
        throw conflict("这条内容和你刚才提交的问题重复。请使用第一次提交时保存的查看链接。");
      }
    }

    const now = iso(ctx);
    const risky = isHighRisk(input.content);
    const questionId = newId();
    const viewTokenHash = hashToken(ctx.config.viewTokenPepper, input.view_token);
    try {
      withTransaction(ctx.db, () => {
        const again = findIdempotentQuestion(ctx.db, box.id, input.idempotency_key);
        if (again) return;
        pruneGuards(ctx.db, new Date(ctx.now() - ctx.config.guardRetentionMs).toISOString());
        insertQuestion(ctx.db, {
          id: questionId,
          box_id: box.id,
          content: input.content,
          asker_display_name: anonymous ? null : input.asker_display_name,
          is_anonymous: anonymous,
          public_consent: input.allow_public,
          status: risky && ctx.config.autoFlagRisk ? "flagged" : "submitted",
          risk_level: risky ? "review" : "none",
          submitted_at: now,
          idempotencyKey: input.idempotency_key,
          contentHash: hash,
          ipHash,
          viewTokenHash,
        });
        writeAudit(ctx.db, {
          actorId: null,
          action: "question.submit",
          resourceType: "question",
          resourceId: questionId,
          metadata: { box_id: box.id, anonymous, risk: risky ? "review" : "none", public_consent: input.allow_public },
          createdAt: now,
        });
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        const existing = findIdempotentQuestion(ctx.db, box.id, input.idempotency_key);
        if (existing) return replayOwned(ctx, existing, input.view_token);
      }
      throw error;
    }
    const existing = findIdempotentQuestion(ctx.db, box.id, input.idempotency_key);
    if (existing && existing !== questionId) return replayOwned(ctx, existing, input.view_token);
    return { id: existing ?? questionId };
  });
}

function replayOwned(ctx: AppContext, questionId: string, token: string): { id: string } {
  if (!ownsViewToken(ctx, questionId, token)) {
    throw conflict("这次重试和原来的提交不一致。请使用第一次提交时保存的查看链接。");
  }
  return { id: questionId };
}

function ownsViewToken(ctx: AppContext, questionId: string, token: string): boolean {
  const stored = findViewTokenHash(ctx.db, questionId);
  if (!stored) return false;
  return hashesMatch(stored, hashToken(ctx.config.viewTokenPepper, token));
}

function loadPublicBox(ctx: AppContext, slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (slugProblem(normalized)) throw notFound();
  const box = findBoxBySlug(ctx.db, normalized);
  if (!box) throw notFound();
  return box;
}
