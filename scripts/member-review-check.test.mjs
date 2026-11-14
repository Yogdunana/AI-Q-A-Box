import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReview } from "./member-review-check.mjs";

const head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const other = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function comment(body, createdAt, userLogin = "Yogdunana") {
  return { userLogin, body, createdAt };
}

function approval(sha = head, reviewer = "TRAE CN") {
  return `Review-Decision: approve
Reviewer-Bot: ${reviewer}
Reviewed-Head: ${sha}

结论：可以合并。`;
}

test("缺少 Author-Bot 时不通过", () => {
  const result = evaluateReview({
    body: "只有说明",
    comments: [comment(approval(), "2026-11-14T12:05:00Z")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Author-Bot/);
});

test("未知成员不能作为作者", () => {
  const result = evaluateReview({
    body: "Author-Bot: Someone Else",
    comments: [],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /不在四位成员内/);
});

test("另一位成员批准当前提交则通过", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor\n\n说明",
    comments: [comment(approval(), "2026-11-14T12:05:00Z")],
    headSha: head,
  });
  assert.deepEqual(result, {
    ok: true,
    errors: [],
    authorBot: "Cursor",
    reviewerBot: "TRAE CN",
  });
});

test("所有者可以审核当前提交", () => {
  const result = evaluateReview({
    body: "Author-Bot: WorkBuddy",
    comments: [comment(approval(head, "owner"), "2026-11-14T13:00:00Z")],
    headSha: head,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reviewerBot, "owner");
});

test("作者不能审核自己", () => {
  const result = evaluateReview({
    body: "Author-Bot: TRAE CN",
    comments: [comment(approval(head, "TRAE CN"), "2026-11-14T13:00:00Z")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /同一位/);
});

test("指向其他提交的批准不能覆盖当前提交", () => {
  const result = evaluateReview({
    body: "Author-Bot: ChatGPT Work",
    comments: [comment(approval(other), "2026-11-14T13:00:00Z")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /不是当前最新提交/);
});

test("git 提交时间早于批准也不能代替 SHA 一致", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval(other), "2026-11-14T18:00:00Z")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /不是当前最新提交/);
});

test("外部账号的批准无效", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval(), "2026-11-14T13:00:00Z", "outsider")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /还没有/);
});

test("当前提交上最新的 request-changes 覆盖更早的 approve", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [
      comment(approval(), "2026-11-14T12:10:00Z"),
      comment(`Review-Decision: request-changes\nReviewer-Bot: WorkBuddy\nReviewed-Head: ${head}`, "2026-11-14T12:20:00Z"),
    ],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /request-changes/);
});

test("多条 Author-Bot 不通过", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor\nAuthor-Bot: WorkBuddy",
    comments: [comment(approval(), "2026-11-14T12:10:00Z")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /多条/);
});

test("缺少 Reviewed-Head 的评论不算审核", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment("Review-Decision: approve\nReviewer-Bot: TRAE CN", "2026-11-14T12:10:00Z")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /还没有/);
});
