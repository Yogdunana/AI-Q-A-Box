import { describe, expect, it } from "vitest";
import type { Answer } from "../api/types";
import { countFor, INBOX_VIEW_BY_ID, isInboxView, restoredStatus } from "./status";

const answer = (patch: Partial<Answer>): Answer => ({
  id: "a",
  question_id: "q",
  content: "hi",
  visibility: "private",
  source: "human",
  updated_at: "2026-01-01T00:00:00Z",
  published_at: null,
  sent_at: null,
  delivery_state: "draft",
  confirmed_content: null,
  confirmed_at: null,
  seen_at: null,
  draft_revision: 1,
  ...patch,
});

describe("restoredStatus", () => {
  it("returns a question to the furthest reply stage it reached", () => {
    expect(restoredStatus(null, false)).toBe("reviewing");
    expect(restoredStatus(null, true)).toBe("drafted");
    expect(restoredStatus(answer({}), false)).toBe("drafted");
    expect(restoredStatus(answer({ sent_at: "2026-01-02T00:00:00Z" }), false)).toBe("answered_private");
    expect(restoredStatus(answer({ visibility: "public", published_at: "2026-01-02T00:00:00Z" }), false)).toBe(
      "published",
    );
  });
});

describe("inbox views", () => {
  it("sums counts across the statuses of a view", () => {
    const counts = { submitted: 2, reviewing: 1, drafted: 3, flagged: 1, archived: 9 };
    expect(countFor(INBOX_VIEW_BY_ID.pending, counts)).toBe(7);
    expect(countFor(INBOX_VIEW_BY_ID.answered, counts)).toBe(0);
  });

  it("recognizes valid view ids only", () => {
    expect(isInboxView("pending")).toBe(true);
    expect(isInboxView("deleted")).toBe(false);
    expect(isInboxView(null)).toBe(false);
  });
});
