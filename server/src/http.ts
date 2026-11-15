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

/**
 * Aborts only when the response connection closes before a response is finished.
 * Request "close" also fires after a normal body read, so it is not used here.
 */
export function abortWhenClientLeaves(request: FastifyRequest, reply: FastifyReply): { signal: AbortSignal; stop(): void } {
  const controller = new AbortController();
  const onClose = () => {
    if (reply.raw.writableFinished || reply.sent) return;
    controller.abort();
  };
  reply.raw.on("close", onClose);
  if (request.raw.aborted) controller.abort();
  return {
    signal: controller.signal,
    stop() {
      reply.raw.removeListener("close", onClose);
    },
  };
}
