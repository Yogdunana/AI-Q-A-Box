import type { PatchStatus, QuestionStatus, ReplyVisibility } from "./constants.ts";
import { forbidden, validation } from "./errors.ts";

export interface DeliveryDecision {
  delivery_state: "draft" | "private_reserved" | "published";
  visibility: ReplyVisibility;
  published_at: string | null;
  sent_at: string | null;
  published_content: string | null;
  question_status: "published" | "answered_private";
}

/**
 * Owner confirmation is the only way into private_reserved or published.
 * sent_at records that confirmation. It does not mean a message was delivered:
 * the MVP does not collect an asker contact, so there is nothing to send.
 * Public text is copied into published_content. Later edits of the draft do
 * not change that copy until the owner confirms again.
 */
export function decideDelivery(input: {
  visibility: ReplyVisibility;
  content: string;
  now: string;
  publicRepliesEnabled: boolean;
}): DeliveryDecision {
  if (!input.content.trim()) {
    throw validation({ content: "回复内容不能为空。" });
  }
  if (input.visibility === "public") {
    if (!input.publicRepliesEnabled) {
      throw forbidden("公开发布还没有开放，这次没有公开。");
    }
    return {
      delivery_state: "published",
      visibility: "public",
      published_at: input.now,
      sent_at: null,
      published_content: input.content,
      question_status: "published",
    };
  }
  return {
    delivery_state: "private_reserved",
    visibility: "private",
    published_at: null,
    sent_at: input.now,
    published_content: null,
    question_status: "answered_private",
  };
}

export function statusAfterDraft(current: QuestionStatus): QuestionStatus {
  if (current === "submitted" || current === "reviewing") return "drafted";
  return current;
}

export function assertStatusPatch(input: {
  next: PatchStatus;
  answer: { published_at: string | null; sent_at: string | null } | null;
  hasDraft: boolean;
}): void {
  if (input.next === "published" && !input.answer?.published_at) {
    throw validation({ status: "需要通过发布确认后才能标为已公开。" });
  }
  if (input.next === "answered_private" && !input.answer?.sent_at) {
    throw validation({ status: "需要通过私密确认后才能标为已私密回复。" });
  }
  if (input.next === "drafted" && !input.answer && !input.hasDraft) {
    throw validation({ status: "还没有草稿，不能标成有草稿。" });
  }
}
