import { createHttpClient } from "./http";
import { createMockClient } from "./mock/client";
import type { ApiClient } from "./types";

const mode = import.meta.env.VITE_API_MODE === "http" ? "http" : "mock";

export const api: ApiClient =
  mode === "http" ? createHttpClient(import.meta.env.VITE_API_BASE_URL ?? "") : createMockClient();

export function resetMockData() {
  window.localStorage.removeItem("askme:mock-db");
  window.localStorage.removeItem("askme:mock-session");
}

export * from "./types";
export * from "./errors";
