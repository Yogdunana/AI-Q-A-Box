const PREFIX = "askme:owner-draft:";

export interface OwnerDraftCopy {
  content: string;
  visibility: "private" | "public";
  source: "human" | "ai_assisted";
  revision: number;
}

export function ownerDraftKey(userId: string, questionId: string): string {
  return `${PREFIX}${userId}:${questionId}`;
}

export function readOwnerDraft(userId: string, questionId: string): OwnerDraftCopy | null {
  const raw = localStorage.getItem(ownerDraftKey(userId, questionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OwnerDraftCopy>;
    if (typeof parsed.content !== "string" || typeof parsed.revision !== "number") return null;
    if (parsed.visibility !== "private" && parsed.visibility !== "public") return null;
    if (parsed.source !== "human" && parsed.source !== "ai_assisted") return null;
    return {
      content: parsed.content,
      visibility: parsed.visibility,
      source: parsed.source,
      revision: parsed.revision,
    };
  } catch {
    return null;
  }
}

export function writeOwnerDraft(userId: string, questionId: string, draft: OwnerDraftCopy) {
  localStorage.setItem(ownerDraftKey(userId, questionId), JSON.stringify(draft));
}

export function clearOwnerDraft(userId: string, questionId: string) {
  localStorage.removeItem(ownerDraftKey(userId, questionId));
}

/** Removes every account's local reply copy. Call this on logout and account switch. */
export function clearOwnerDrafts() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}
