import { resolveAppIntent, type ApiMode, type AppIntent } from "./runtime-intent";

const resolved = resolveAppIntent({
  command: import.meta.env.MODE === "production" ? "build" : "serve",
  mode: import.meta.env.MODE,
  env: {
    VITE_APP_INTENT: import.meta.env.VITE_APP_INTENT,
    VITE_API_MODE: import.meta.env.VITE_API_MODE,
  },
});

export const runtime: { intent: AppIntent; apiMode: ApiMode; apiBaseUrl: string } = {
  intent: resolved.intent,
  apiMode: resolved.apiMode,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
};
