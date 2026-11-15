/** 32 bytes, base64url. The server stores only an HMAC of this value. */
export function newViewToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function replyLink(token: string): string {
  return `${window.location.origin}/reply#${token}`;
}

const SUBMITTED_PREFIX = "askme:submitted-view:";
const ACTIVE_REPLY = "askme:active-reply-token";

export function rememberSubmittedToken(slug: string, token: string) {
  sessionStorage.setItem(`${SUBMITTED_PREFIX}${slug}`, token);
}

export function submittedToken(slug: string): string | null {
  return sessionStorage.getItem(`${SUBMITTED_PREFIX}${slug}`);
}

export function rememberReplyToken(token: string) {
  sessionStorage.setItem(ACTIVE_REPLY, token);
}

export function activeReplyToken(): string | null {
  return sessionStorage.getItem(ACTIVE_REPLY);
}
