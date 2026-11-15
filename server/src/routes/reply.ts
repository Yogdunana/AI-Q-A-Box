import type { FastifyInstance } from "fastify";
import { writeAudit } from "../audit.ts";
import type { AppContext } from "../context.ts";
import { iso } from "../context.ts";
import { hashToken } from "../crypto.ts";
import { withTransaction } from "../db.ts";
import { notFound } from "../errors.ts";
import { clientHash } from "../http.ts";
import { consume } from "../rate-limit.ts";
import { findReplyByTokenHash, markReplySeen } from "../store.ts";
import { parseReplyToken } from "../validate.ts";

const INVALID = "这个查看链接无效。";

/**
 * Askers prove they hold the link by posting the token. It is never taken from
 * the URL, so access logs and Referer headers do not receive it.
 */
export function registerReplyRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/reply-access", async (request) => {
    consume(
      ctx,
      `reply:${clientHash(ctx, request)}`,
      ctx.config.replyRateLimit,
      ctx.config.replyRateWindowMs,
      "查看得有点频繁，请稍等一会儿再试。",
    );
    const token = parseReplyToken(request.body);
    const link = findReplyByTokenHash(ctx.db, hashToken(ctx.config.viewTokenPepper, token));
    if (!link) throw notFound(INVALID);
    if (link.status === "deleted" || link.deleted_at) {
      return { state: "deleted" as const };
    }
    if (!link.confirmed_content || !link.confirmed_at) {
      return {
        state: "pending" as const,
        box: { title: link.box_title, owner_display_name: link.owner_display_name },
        question: { content: link.content, submitted_at: link.submitted_at },
        reply: null,
      };
    }
    const seenAt = iso(ctx);
    withTransaction(ctx.db, () => {
      const firstView = markReplySeen(ctx.db, link.id, seenAt);
      if (!firstView) return;
      writeAudit(ctx.db, {
        actorId: null,
        action: "reply.view",
        resourceType: "question",
        resourceId: link.id,
        metadata: { state: "confirmed" },
        createdAt: seenAt,
      });
    });
    return {
      state: "confirmed" as const,
      box: { title: link.box_title, owner_display_name: link.owner_display_name },
      question: { content: link.content, submitted_at: link.submitted_at },
      reply: { content: link.confirmed_content, confirmed_at: link.confirmed_at },
    };
  });
}
