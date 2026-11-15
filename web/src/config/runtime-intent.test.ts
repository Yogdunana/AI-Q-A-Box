import { describe, expect, it } from "vitest";
import { resolveAppIntent } from "./runtime-intent";

describe("resolveAppIntent", () => {
  it("lets local development use mock data", () => {
    expect(resolveAppIntent({ command: "serve", mode: "development", env: {} })).toEqual({
      intent: "development",
      apiMode: "mock",
    });
  });

  it("lets local development call the API when asked", () => {
    expect(
      resolveAppIntent({ command: "serve", mode: "development", env: { VITE_API_MODE: "http" } }),
    ).toEqual({ intent: "development", apiMode: "http" });
  });

  it("keeps an explicit demo build in the browser", () => {
    expect(resolveAppIntent({ command: "build", mode: "demo", env: { VITE_APP_INTENT: "demo" } })).toEqual({
      intent: "demo",
      apiMode: "mock",
    });
  });

  it("fails a production build that does not explicitly select the real API", () => {
    expect(() => resolveAppIntent({ command: "build", mode: "production", env: {} })).toThrow(/VITE_APP_INTENT/);
    expect(() =>
      resolveAppIntent({ command: "build", mode: "production", env: { VITE_APP_INTENT: "production" } }),
    ).toThrow(/VITE_API_MODE=http/);
    expect(() =>
      resolveAppIntent({
        command: "build",
        mode: "production",
        env: { VITE_APP_INTENT: "production", VITE_API_MODE: "mock" },
      }),
    ).toThrow(/does not fall back to mock/);
  });

  it("accepts an explicit production API build", () => {
    expect(
      resolveAppIntent({
        command: "build",
        mode: "production",
        env: { VITE_APP_INTENT: "production", VITE_API_MODE: "http" },
      }),
    ).toEqual({ intent: "production", apiMode: "http" });
  });

  it("rejects unknown values", () => {
    expect(() =>
      resolveAppIntent({ command: "serve", mode: "development", env: { VITE_APP_INTENT: "staging" } }),
    ).toThrow(/development, demo, or production/);
  });
});
