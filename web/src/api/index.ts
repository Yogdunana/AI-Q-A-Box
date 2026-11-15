import { runtime } from "../config/runtime";
import { createHttpClient } from "./http";
import { createMockClient } from "./mock/client";
import type { ApiClient } from "./types";

export const api: ApiClient =
  runtime.apiMode === "http" ? createHttpClient(runtime.apiBaseUrl) : createMockClient();

export function resetMockData() {
  window.localStorage.removeItem("askme:mock-db");
  window.localStorage.removeItem("askme:mock-session");
}

export * from "./types";
export * from "./errors";
