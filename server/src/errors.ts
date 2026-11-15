export class HttpError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.fields = fields;
  }
}

export function badRequest(message = "提交的内容有误，请检查后重试。"): HttpError {
  return new HttpError(400, message);
}

export function unauthorized(message = "登录状态已失效，请重新登录。"): HttpError {
  return new HttpError(401, message);
}

export function forbidden(message: string): HttpError {
  return new HttpError(403, message);
}

export function notFound(message = "没有找到对应的内容。"): HttpError {
  return new HttpError(404, message);
}

export function conflict(message: string, fields: Record<string, string> = {}): HttpError {
  return new HttpError(409, message, fields);
}

export function validation(fields: Record<string, string>): HttpError {
  const message = Object.values(fields)[0] ?? "提交的内容有误，请检查后重试。";
  return new HttpError(422, message, fields);
}

export function rateLimited(message: string): HttpError {
  return new HttpError(429, message);
}

export function unavailable(message: string): HttpError {
  return new HttpError(503, message);
}
