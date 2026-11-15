import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppContext } from "./context.ts";
import { fingerprint } from "./crypto.ts";
import { badRequest, notFound, unauthorized } from "./errors.ts";
import { currentUser } from "./session.ts";
import type { UserRecord } from "./store.ts";

export function requireUser(ctx: AppContext, request: FastifyRequest): UserRecord {
  const user = currentUser(ctx, request);
  if (!user) throw unauthorized();
  return user;
}

export function clientIp(request: FastifyRequest): string {
  return request.ip || "unknown";
}

export function clientHash(ctx: AppContext, request: FastifyRequest): string {
  return fingerprint(ctx.config.ipPepper, clientIp(request));
}

export function param(request: FastifyRequest, name: string): string {
  const params = request.params as Record<string, unknown>;
  const value = params[name];
  if (typeof value !== "string" || value.length === 0) throw notFound();
  return value;
}

export function queryString(request: FastifyRequest, name: string): string {
  const query = request.query as Record<string, unknown>;
  const value = query[name];
  if (value === undefined) return "";
  if (typeof value !== "string") throw badRequest();
  return value;
}

export function noContent(reply: FastifyReply): FastifyReply {
  return reply.code(204).send();
}
