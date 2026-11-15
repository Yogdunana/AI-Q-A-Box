export type AppIntent = "development" | "demo" | "production";
export type ApiMode = "mock" | "http";

export interface ResolvedRuntime {
  intent: AppIntent;
  apiMode: ApiMode;
}

const INTENTS = new Set<AppIntent>(["development", "demo", "production"]);

/**
 * Development may use mock data. Demo must stay in the browser and say so.
 * A production build has to opt into the real API; a missing or illegal value fails.
 */
export function resolveAppIntent(input: {
  command: "build" | "serve";
  mode: string;
  env: Record<string, string | undefined>;
}): ResolvedRuntime {
  const intentRaw = input.env.VITE_APP_INTENT?.trim() ?? "";
  const apiRaw = input.env.VITE_API_MODE?.trim() ?? "";
  if (apiRaw && apiRaw !== "mock" && apiRaw !== "http") {
    throw new Error("VITE_API_MODE must be mock or http");
  }
  if (intentRaw && !INTENTS.has(intentRaw as AppIntent)) {
    throw new Error("VITE_APP_INTENT must be development, demo, or production");
  }

  const intent = (intentRaw || (input.command === "build" ? "" : "development")) as AppIntent | "";
  if (!intent) {
    throw new Error("Set VITE_APP_INTENT=production with VITE_API_MODE=http, or VITE_APP_INTENT=demo. A production build does not fall back to mock.");
  }
  if (intent === "production") {
    if (apiRaw !== "http") {
      throw new Error("Production requires VITE_API_MODE=http and does not fall back to mock");
    }
    return { intent, apiMode: "http" };
  }
  if (intent === "demo") {
    if (apiRaw === "http") throw new Error("Demo mode keeps data in this browser and cannot call the real API");
    return { intent, apiMode: "mock" };
  }
  if (input.command === "build" && input.mode === "production") {
    throw new Error("Set VITE_APP_INTENT=production with VITE_API_MODE=http, or VITE_APP_INTENT=demo");
  }
  return { intent: "development", apiMode: apiRaw === "http" ? "http" : "mock" };
}
