import type { DatabaseSync } from "node:sqlite";
import type { AiProvider } from "./ai/types.ts";
import type { Config } from "./config.ts";

export interface AppContext {
  db: DatabaseSync;
  config: Config;
  now: () => number;
  ai: AiProvider;
}

export function iso(ctx: AppContext): string {
  return new Date(ctx.now()).toISOString();
}
