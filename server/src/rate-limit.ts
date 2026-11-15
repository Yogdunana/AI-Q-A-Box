import type { AppContext } from "./context.ts";
import { withTransaction } from "./db.ts";
import { rateLimited } from "./errors.ts";

export function consume(
  ctx: AppContext,
  scope: string,
  limit: number,
  windowMs: number,
  message = "操作太频繁了，请稍后再试。",
): void {
  const now = ctx.now();
  const cutoff = now - windowMs;
  let allowed = false;
  withTransaction(ctx.db, () => {
    ctx.db.prepare("DELETE FROM rate_hits WHERE scope = ? AND at_ms < ?").run(scope, cutoff);
    const row = ctx.db.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE scope = ?").get(scope) as
      | { n: number | bigint }
      | undefined;
    if (Number(row?.n ?? 0) >= limit) return;
    ctx.db.prepare("INSERT INTO rate_hits (scope, at_ms) VALUES (?, ?)").run(scope, now);
    allowed = true;
  });
  if (!allowed) throw rateLimited(message);
}
