import { ApiError, codeForStatus } from "./errors";
import type {
  AiGeneration,
  Answer,
  ApiClient,
  PublicAnswer,
  PublicBox,
  Question,
  QuestionBox,
  QuestionDetail,
  QuestionList,
  Session,
  User,
} from "./types";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface ErrorBody {
  message?: string;
  fields?: Record<string, string>;
}

/**
 * REST client for the endpoints listed in docs/prd.md §10.1. Session cookies
 * are HttpOnly and managed by the server, so every request sends credentials.
 */
export function createHttpClient(baseUrl = ""): ApiClient {
  async function request<T>(
    method: Method,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: "include",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch {
      if (signal?.aborted) throw new ApiError("aborted", "");
      throw new ApiError("network", "");
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const data: unknown = text ? safeJson(text) : undefined;

    if (!response.ok) {
      const err = (data ?? {}) as ErrorBody;
      throw new ApiError(codeForStatus(response.status), err.message ?? "", {
        status: response.status,
        fields: err.fields,
      });
    }
    return data as T;
  }

  const enc = encodeURIComponent;

  return {
    mode: "http",

    async getSession() {
      try {
        return await request<Session>("GET", "/api/me");
      } catch (error) {
        if (error instanceof ApiError && error.code === "unauthorized") return null;
        throw error;
      }
    },
    login: (input) => request<Session>("POST", "/api/auth/login", input),
    register: (input) => request<Session>("POST", "/api/auth/register", input),
    logout: () => request<void>("POST", "/api/auth/logout"),
    updateProfile: (input) => request<User>("PATCH", "/api/me", input),

    getPublicBox: (slug) => request<PublicBox>("GET", `/api/boxes/${enc(slug)}`),
    getPublicAnswers: (slug) => request<PublicAnswer[]>("GET", `/api/boxes/${enc(slug)}/answers`),
    submitQuestion: (slug, input) =>
      request<{ id: string }>("POST", `/api/boxes/${enc(slug)}/questions`, input),

    createBox: (input) => request<QuestionBox>("POST", "/api/me/boxes", input),
    updateBox: (id, input) => request<QuestionBox>("PATCH", `/api/me/boxes/${enc(id)}`, input),

    listQuestions: ({ status, q }) => {
      const params = new URLSearchParams();
      if (status?.length) params.set("status", status.join(","));
      if (q) params.set("q", q);
      const qs = params.toString();
      return request<QuestionList>("GET", `/api/me/questions${qs ? `?${qs}` : ""}`);
    },
    getQuestion: (id) => request<QuestionDetail>("GET", `/api/me/questions/${enc(id)}`),
    updateQuestionStatus: (id, status) =>
      request<Question>("PATCH", `/api/me/questions/${enc(id)}`, { status }),
    deleteQuestion: (id) => request<void>("DELETE", `/api/me/questions/${enc(id)}`),

    generateDraft: (questionId, signal) =>
      request<AiGeneration>("POST", `/api/me/questions/${enc(questionId)}/ai-drafts`, {}, signal),
    deleteDraft: (questionId, generationId) =>
      request<void>(
        "DELETE",
        `/api/me/questions/${enc(questionId)}/ai-drafts/${enc(generationId)}`,
      ),

    saveAnswer: (questionId, input) =>
      request<Answer>("POST", `/api/me/questions/${enc(questionId)}/answers`, input),
    updateAnswer: (answerId, input) =>
      request<Answer>("PATCH", `/api/me/answers/${enc(answerId)}`, input),
    publishAnswer: (answerId, visibility) =>
      request<Answer>("POST", `/api/me/answers/${enc(answerId)}/publish`, { visibility }),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
