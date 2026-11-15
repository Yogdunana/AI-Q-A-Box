import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "./context.ts";
import { iso } from "./context.ts";
import { hashToken, newToken } from "./crypto.ts";
import { deleteSession, findSession, findUserById, insertSession, revokeSession, type UserRecord } from "./store.ts";

export function currentUser(ctx: AppContext, request: FastifyRequest): UserRecord | null {
  const token = request.cookies?.[ctx.config.cookieName];
  if (!token) return null;
  const tokenHash = hashToken(ctx.config.sessionSecret, token);
  const session = findSession(ctx.db, tokenHash);
  if (!session || session.revoked_at || session.expires_at <= iso(ctx)) {
    if (session) deleteSession(ctx.db, tokenHash);
    return null;
  }
  const user = findUserById(ctx.db, session.user_id);
  if (!user || user.deleted_at) return null;
  return user;
}

export function startSession(ctx: AppContext, reply: FastifyReply, userId: string): void {
  const token = newToken();
  const now = iso(ctx);
  const expires = new Date(ctx.now() + ctx.config.sessionTtlMs).toISOString();
  insertSession(ctx.db, {
    tokenHash: hashToken(ctx.config.sessionSecret, token),
    userId,
    createdAt: now,
    expiresAt: expires,
  });
  reply.setCookie(ctx.config.cookieName, token, {
    httpOnly: true,
    secure: ctx.config.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ctx.config.sessionTtlMs / 1000),
  });
}

export function endSession(ctx: AppContext, request: FastifyRequest, reply: FastifyReply): void {
  const token = request.cookies?.[ctx.config.cookieName];
  if (token) revokeSession(ctx.db, hashToken(ctx.config.sessionSecret, token), iso(ctx));
  reply.clearCookie(ctx.config.cookieName, { path: "/" });
}
