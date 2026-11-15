export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "network"
  | "invalid_response"
  | "aborted"
  | "server";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: Record<string, string>;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { status?: number; fields?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? 0;
    this.fields = options.fields ?? {};
  }
}

const statusToCode: Record<number, ApiErrorCode> = {
  400: "validation",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "validation",
  429: "rate_limited",
};

export function codeForStatus(status: number): ApiErrorCode {
  return statusToCode[status] ?? "server";
}

const fallbackMessages: Record<ApiErrorCode, string> = {
  unauthorized: "登录状态已失效，请重新登录。",
  forbidden: "你没有权限执行这个操作。",
  not_found: "没有找到对应的内容。",
  conflict: "内容和现有数据冲突，请调整后重试。",
  validation: "提交的内容有误，请检查后重试。",
  rate_limited: "操作太频繁了，请稍后再试。",
  network: "网络连接失败，请检查网络后重试。",
  invalid_response: "服务返回了无法识别的内容。请确认站点已接通 API。",
  aborted: "操作已取消。",
  server: "服务暂时不可用，请稍后重试。",
};

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message || fallbackMessages[error.code];
  return fallbackMessages.server;
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
