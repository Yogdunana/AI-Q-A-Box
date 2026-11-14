import type { FastifyInstance } from "fastify";
import { writeAudit } from "../audit.ts";
import type { AppContext } from "../context.ts";
import { iso } from "../context.ts";
import { contentHash, newId } from "../crypto.ts";
import { isUniqueConstraint, withTransaction } from "../db.ts";
import { forbidden, notFound } from "../errors.ts";
import { clientHash } from "../http.ts";
import { param } from "../http.ts";
import { publicBoxJson } from "../present.ts";
import { consume } from "../rate-limit.ts";
import { isHighRisk } from "../risk.ts";
import {
  findBoxBySlug,
  findIdempotentQuestion,
  findRecentDuplicate,
  insertQuestion,
  listPublicAnswers,
  pruneGuards,
} from "../store.ts";
import { nicknameRequired, parseIdempotencyKey, parseSubmit, slugProblem } from "../validate.ts";

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
    const key = parseIdempotencyKey(request.body);
    const replay = findIdempotentQuestion(ctx.db, box.id, key);
    if (replay) return { id: replay };

    consume(ctx, `submit:${box.id}:${clientHash(ctx, request)}`, ctx.config.submitRateLimit, ctx.config.submitRateWindowMs, SUBMIT_LIMIT);
    const input = parseSubmit(request.body);
    const anonymous = box.anonymous_mode === "allowed" && input.is_anonymous;
    if (!anonymous && !input.asker_display_name) throw nicknameRequired();

    const hash = contentHash(input.content);
    const ipHash = clientHash(ctx, request);
    if (ctx.config.dedupeWindowMs > 0) {
      const since = new Date(ctx.now() - ctx.config.dedupeWindowMs).toISOString();
      const duplicate = findRecentDuplicate(ctx.db, box.id, hash, ipHash, since);
      if (duplicate) return { id: duplicate };
    }

    const now = iso(ctx);
    const risky = isHighRisk(input.content);
    const questionId = newId();
    try {
      withTransaction(ctx.db, () => {
        const again = findIdempotentQuestion(ctx.db, box.id, key);
        if (again) return;
        pruneGuards(ctx.db, new Date(ctx.now() - ctx.config.guardRetentionMs).toISOString());
        insertQuestion(ctx.db, {
          id: questionId,
          box_id: box.id,
          content: input.content,
          asker_display_name: anonymous ? null : input.asker_display_name,
          is_anonymous: anonymous,
          status: risky && ctx.config.autoFlagRisk ? "flagged" : "submitted",
          risk_level: risky ? "review" : "none",
          submitted_at: now,
          idempotencyKey: key,
          contentHash: hash,
          ipHash,
        });
        writeAudit(ctx.db, {
          actorId: null,
          action: "question.submit",
          resourceType: "question",
          resourceId: questionId,
          metadata: { box_id: box.id, anonymous, risk: risky ? "review" : "none" },
          createdAt: now,
        });
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        const existing = findIdempotentQuestion(ctx.db, box.id, key);
        if (existing) return { id: existing };
      }
      throw error;
    }
    const existing = findIdempotentQuestion(ctx.db, box.id, key);
    return { id: existing ?? questionId };
  });
}

function loadPublicBox(ctx: AppContext, slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (slugProblem(normalized)) throw notFound();
  const box = findBoxBySlug(ctx.db, normalized);
  if (!box) throw notFound();
  return box;
}
