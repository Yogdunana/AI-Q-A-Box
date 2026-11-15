import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { AiProvider } from "./ai/types.ts";
import type { Config } from "./config.ts";
import type { AppContext } from "./context.ts";
import { HttpError } from "./errors.ts";
import { forbidden } from "./errors.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerOwnerRoutes } from "./routes/owner.ts";
import { registerPublicRoutes } from "./routes/public.ts";
import type { DatabaseSync } from "node:sqlite";

export interface BuildOptions {
  db: DatabaseSync;
  config: Config;
  now?: () => number;
  ai: AiProvider;
  extraRoutes?: (app: FastifyInstance, ctx: AppContext) => void;
}

export function buildApp(options: BuildOptions): FastifyInstance {
  const ctx: AppContext = {
    db: options.db,
    config: options.config,
    now: options.now ?? Date.now,
    ai: options.ai,
  };
  const app = Fastify({
    trustProxy: ctx.config.trustProxy ? "127.0.0.1" : false,
    bodyLimit: ctx.config.bodyLimit,
    requestTimeout: ctx.config.requestTimeoutMs,
    logController: new LogController({ disableRequestLogging: true }),
    logger:
      ctx.config.env === "test"
        ? false
        : {
            level: "info",
            redact: ["req.headers.cookie", "req.headers.authorization", "res.headers.set-cookie"],
          },
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("cache-control", "no-store");
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
    const origin = request.headers.origin;
    if (!origin) return;
    if (!ctx.config.webOrigins.includes(origin)) throw forbidden("请求来源不被允许。");
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      const payload: { message: string; fields?: Record<string, string> } = { message: error.message };
      if (Object.keys(error.fields).length > 0) payload.fields = error.fields;
      return reply.status(error.status).send(payload);
    }
    const status = statusCodeOf(error);
    if (status === 429) return reply.status(429).send({ message: "操作太频繁了，请稍后再试。" });
    if (status >= 400 && status < 500) {
      return reply.status(status).send({ message: "提交的内容有误，请检查后重试。" });
    }
    app.log.error(
      { err: error, method: request.method, route: request.routeOptions.url },
      "request failed",
    );
    return reply.status(500).send({ message: "服务暂时不可用，请稍后重试。" });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ message: "没有找到对应的内容。" });
  });

  app.register(async (instance) => {
    await instance.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    });
    await instance.register(cors, {
      origin(origin, callback) {
        if (!origin || ctx.config.webOrigins.includes(origin)) callback(null, true);
        else callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
      maxAge: 600,
    });
    await instance.register(cookie);
    instance.get("/api/health", async () => ({ ok: true }));
    registerAuthRoutes(instance, ctx);
    registerPublicRoutes(instance, ctx);
    registerOwnerRoutes(instance, ctx);
    options.extraRoutes?.(instance, ctx);
  });

  return app;
}

function statusCodeOf(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return 500;
}
