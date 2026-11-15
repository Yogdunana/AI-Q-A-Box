import { ApiError, codeForStatus } from "./errors";
import type {
  AiGeneration,
  Answer,
  ApiClient,
  Capabilities,
  PublicAnswer,
  PublicBox,
  Question,
  QuestionBox,
  QuestionDetail,
  QuestionList,
  ReplyAccess,
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

    const data = await readJson(response);

    if (!response.ok) {
      const err = (isRecord(data) ? data : {}) as ErrorBody;
      throw new ApiError(codeForStatus(response.status), err.message ?? "", {
        status: response.status,
        fields: err.fields,
      });
    }
    return data as T;
  }

  function record<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<unknown>(method, path, body, signal).then((data) => {
      if (!isRecord(data)) throw new ApiError("invalid_response", "");
      return data as T;
    });
  }

  function list<T>(method: Method, path: string): Promise<T[]> {
    return request<unknown>(method, path).then((data) => {
      if (!Array.isArray(data)) throw new ApiError("invalid_response", "");
      return data as T[];
    });
  }

  const enc = encodeURIComponent;

  return {
    mode: "http",

    async getSession() {
      try {
        return await record<Session>("GET", "/api/me");
      } catch (error) {
        if (error instanceof ApiError && error.code === "unauthorized") return null;
        throw error;
      }
    },
    login: (input) => record<Session>("POST", "/api/auth/login", input),
    register: (input) => record<Session>("POST", "/api/auth/register", input),
    logout: () => request<void>("POST", "/api/auth/logout"),
    updateProfile: (input) => record<User>("PATCH", "/api/me", input),

    getCapabilities: () => record<Capabilities>("GET", "/api/capabilities"),
    getPublicBox: (slug) => record<PublicBox>("GET", `/api/boxes/${enc(slug)}`),
    getPublicAnswers: (slug) => list<PublicAnswer>("GET", `/api/boxes/${enc(slug)}/answers`),
    submitQuestion: (slug, input) =>
      record<{ id: string }>("POST", `/api/boxes/${enc(slug)}/questions`, input),
    readReply: (token) => record<ReplyAccess>("POST", "/api/reply-access", { token }),

    createBox: (input) => record<QuestionBox>("POST", "/api/me/boxes", input),
    updateBox: (id, input) => record<QuestionBox>("PATCH", `/api/me/boxes/${enc(id)}`, input),

    listQuestions: ({ status, q }) => {
      const params = new URLSearchParams();
      if (status?.length) params.set("status", status.join(","));
      if (q) params.set("q", q);
      const qs = params.toString();
      return record<QuestionList>("GET", `/api/me/questions${qs ? `?${qs}` : ""}`);
    },
    getQuestion: (id) => record<QuestionDetail>("GET", `/api/me/questions/${enc(id)}`),
    updateQuestionStatus: (id, status) =>
      record<Question>("PATCH", `/api/me/questions/${enc(id)}`, { status }),
    deleteQuestion: (id) => request<void>("DELETE", `/api/me/questions/${enc(id)}`),

    generateDraft: (questionId, signal) =>
      record<AiGeneration>("POST", `/api/me/questions/${enc(questionId)}/ai-drafts`, {}, signal),
    deleteDraft: (questionId, generationId) =>
      request<void>(
        "DELETE",
        `/api/me/questions/${enc(questionId)}/ai-drafts/${enc(generationId)}`,
      ),

    saveAnswer: (questionId, input) =>
      record<Answer>("POST", `/api/me/questions/${enc(questionId)}/answers`, input),
    updateAnswer: (answerId, input) => record<Answer>("PATCH", `/api/me/answers/${enc(answerId)}`, input),
    publishAnswer: (answerId, visibility, draftRevision) =>
      record<Answer>("POST", `/api/me/answers/${enc(answerId)}/publish`, {
        visibility,
        ...(draftRevision === undefined ? {} : { draft_revision: draftRevision }),
      }),
  };
}

async function readJson(response: Response): Promise<unknown> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new ApiError("invalid_response", "");
  }
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("invalid_response", "");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
