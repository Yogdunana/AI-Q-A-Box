import type { FastifyInstance } from "fastify";
import { writeAudit } from "../audit.ts";
import type { AppContext } from "../context.ts";
import { iso } from "../context.ts";
import { hashPassword, newId, passwordMatches } from "../crypto.ts";
import { withTransaction, isUniqueConstraint } from "../db.ts";
import { conflict, unauthorized } from "../errors.ts";
import { clientHash, noContent, requireUser } from "../http.ts";
import { sessionJson } from "../present.ts";
import { consume } from "../rate-limit.ts";
import { currentUser, endSession, startSession } from "../session.ts";
import { findBoxByOwner, findUserByEmail, insertUser, toPublicUser, updateDisplayName } from "../store.ts";
import { parseLogin, parseProfile, parseRegister } from "../validate.ts";

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/auth/register", async (request, reply) => {
    const input = parseRegister(request.body);
    consume(ctx, `register:${clientHash(ctx, request)}`, ctx.config.authRateLimit, ctx.config.authRateWindowMs);
    const now = iso(ctx);
    const user = {
      id: newId(),
      email: input.email,
      password_hash: hashPassword(input.password),
      display_name: input.display_name,
      avatar_url: null,
      created_at: now,
      deleted_at: null,
    };
    try {
      withTransaction(ctx.db, () => {
        insertUser(ctx.db, user);
        writeAudit(ctx.db, {
          actorId: user.id,
          action: "user.register",
          resourceType: "user",
          resourceId: user.id,
          createdAt: now,
        });
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw conflict("这个邮箱已经注册过了。", { email: "这个邮箱已经注册过了。" });
      }
      throw error;
    }
    startSession(ctx, reply, user.id);
    return sessionJson(toPublicUser(user), undefined);
  });

  app.post("/api/auth/login", async (request, reply) => {
    const input = parseLogin(request.body);
    consume(ctx, `login:${clientHash(ctx, request)}`, ctx.config.authRateLimit, ctx.config.authRateWindowMs);
    const user = findUserByEmail(ctx.db, input.email);
    const matches = passwordMatches(input.password, user?.password_hash ?? null);
    if (!user || !matches) {
      writeAudit(ctx.db, {
        actorId: null,
        action: "user.login_failed",
        resourceType: "session",
        resourceId: null,
        metadata: { ip_hash: clientHash(ctx, request) },
        createdAt: iso(ctx),
      });
      throw unauthorized("邮箱或密码不正确。");
    }
    startSession(ctx, reply, user.id);
    writeAudit(ctx.db, {
      actorId: user.id,
      action: "user.login",
      resourceType: "session",
      resourceId: user.id,
      createdAt: iso(ctx),
    });
    return sessionJson(toPublicUser(user), findBoxByOwner(ctx.db, user.id));
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const user = currentUser(ctx, request);
    endSession(ctx, request, reply);
    if (user) {
      writeAudit(ctx.db, {
        actorId: user.id,
        action: "user.logout",
        resourceType: "session",
        resourceId: user.id,
        createdAt: iso(ctx),
      });
    }
    return noContent(reply);
  });

  app.get("/api/me", async (request) => {
    const user = requireUser(ctx, request);
    return sessionJson(toPublicUser(user), findBoxByOwner(ctx.db, user.id));
  });

  app.patch("/api/me", async (request) => {
    const user = requireUser(ctx, request);
    const input = parseProfile(request.body);
    updateDisplayName(ctx.db, user.id, input.display_name);
    writeAudit(ctx.db, {
      actorId: user.id,
      action: "user.profile_update",
      resourceType: "user",
      resourceId: user.id,
      createdAt: iso(ctx),
    });
    return toPublicUser({ ...user, display_name: input.display_name });
  });
}
