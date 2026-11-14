import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { createHttpClient } from "./http";

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn(async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("http client", () => {
  it("calls the PRD endpoints with credentials", async () => {
    const fetch = mockFetch(200, { items: [], total: 0, counts: {} });
    const api = createHttpClient("https://api.example.com");
    await api.listQuestions({ status: ["submitted", "reviewing"], q: "设计" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.example.com/api/me/questions?status=submitted%2Creviewing&q=%E8%AE%BE%E8%AE%A1",
    );
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("sends JSON bodies for mutations", async () => {
    const fetch = mockFetch(200, { id: "q1" });
    await createHttpClient().submitQuestion("lin yi", { content: "hi", is_anonymous: true, idempotency_key: "k" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/boxes/lin%20yi/questions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ content: "hi", is_anonymous: true, idempotency_key: "k" });
  });

  it("maps error statuses to typed errors with field messages", async () => {
    mockFetch(409, { message: "已被使用", fields: { slug: "已被使用" } });
    const error = await createHttpClient()
      .updateBox("b1", { slug: "lin" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "conflict", status: 409, fields: { slug: "已被使用" } });
  });

  it("treats 401 on /api/me as signed out", async () => {
    mockFetch(401);
    await expect(createHttpClient().getSession()).resolves.toBeNull();
  });

  it("reports network failures distinctly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(createHttpClient().getPublicBox("lin")).rejects.toMatchObject({ code: "network" });
  });
});
