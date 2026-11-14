import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReview } from "./member-review-check.mjs";

const head = "2026-11-14T12:00:00Z";

function comment(body, createdAt, userLogin = "Yogdunana") {
  return { userLogin, body, createdAt };
}

const approval = `Review-Decision: approve
Reviewer-Bot: TRAE CN

结论：可以合并。`;

test("缺少 Author-Bot 时不通过", () => {
  const result = evaluateReview({
    body: "只有说明",
    comments: [comment(approval, "2026-11-14T12:05:00Z")],
    headCommittedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Author-Bot/);
});

test("未知成员不能作为作者", () => {
  const result = evaluateReview({
    body: "Author-Bot: Someone Else",
    comments: [],
    headCommittedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /不在四位成员内/);
});

test("另一位成员在最新提交之后批准则通过", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor\n\n说明",
    comments: [comment(approval, "2026-11-14T12:05:00Z")],
    headCommittedAt: head,
  });
  assert.deepEqual(result, {
    ok: true,
    errors: [],
    authorBot: "Cursor",
    reviewerBot: "TRAE CN",
  });
});

test("所有者可以审核", () => {
  const result = evaluateReview({
    body: "Author-Bot: WorkBuddy",
    comments: [comment("Review-Decision: approve\nReviewer-Bot: owner", "2026-11-14T13:00:00Z")],
    headCommittedAt: head,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reviewerBot, "owner");
});

test("作者不能审核自己", () => {
  const result = evaluateReview({
    body: "Author-Bot: TRAE CN",
    comments: [comment("Review-Decision: approve\nReviewer-Bot: TRAE CN", "2026-11-14T13:00:00Z")],
    headCommittedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /同一位/);
});

test("早于最新提交的审核失效", () => {
  const result = evaluateReview({
    body: "Author-Bot: ChatGPT Work",
    comments: [comment(approval, "2026-11-14T11:00:00Z")],
    headCommittedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /最新提交之后/);
});

test("外部账号的批准无效", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval, "2026-11-14T13:00:00Z", "outsider")],
    headCommittedAt: head,
  });
  assert.equal(result.ok, false);
});

test("最新的 request-changes 覆盖更早的 approve", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [
      comment(approval, "2026-11-14T12:10:00Z"),
      comment("Review-Decision: request-changes\nReviewer-Bot: WorkBuddy", "2026-11-14T12:20:00Z"),
    ],
    headCommittedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /request-changes/);
});

test("多条 Author-Bot 不通过", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor\nAuthor-Bot: WorkBuddy",
    comments: [comment(approval, "2026-11-14T12:10:00Z")],
    headCommittedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /多条/);
});
