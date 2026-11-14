import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReview, headLandedAt } from "./member-review-check.mjs";

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
    headLandedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Author-Bot/);
});

test("未知成员不能作为作者", () => {
  const result = evaluateReview({
    body: "Author-Bot: Someone Else",
    comments: [],
    headLandedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /不在四位成员内/);
});

test("另一位成员在最新提交之后批准则通过", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor\n\n说明",
    comments: [comment(approval, "2026-11-14T12:05:00Z")],
    headLandedAt: head,
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
    headLandedAt: head,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reviewerBot, "owner");
});

test("作者不能审核自己", () => {
  const result = evaluateReview({
    body: "Author-Bot: TRAE CN",
    comments: [comment("Review-Decision: approve\nReviewer-Bot: TRAE CN", "2026-11-14T13:00:00Z")],
    headLandedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /同一位/);
});

test("早于最新提交的审核失效", () => {
  const result = evaluateReview({
    body: "Author-Bot: ChatGPT Work",
    comments: [comment(approval, "2026-11-14T11:00:00Z")],
    headLandedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /最新提交之后/);
});

test("外部账号的批准无效", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval, "2026-11-14T13:00:00Z", "outsider")],
    headLandedAt: head,
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
    headLandedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /request-changes/);
});

test("多条 Author-Bot 不通过", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor\nAuthor-Bot: WorkBuddy",
    comments: [comment(approval, "2026-11-14T12:10:00Z")],
    headLandedAt: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /多条/);
});

test("提交时间早于批准、但批准之后才进入 PR 时不通过", () => {
  const timeline = [
    { event: "committed", sha: "aaa", committer: { date: "2026-11-14T10:00:00Z" } },
    { event: "commented", created_at: "2026-11-14T12:00:00Z" },
    { event: "committed", sha: "bbb", committer: { date: "2026-11-14T11:00:00Z" } },
  ];
  const landed = headLandedAt(timeline, "bbb");
  assert.equal(landed, "2026-11-14T12:00:00Z");
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval, "2026-11-14T12:00:00Z")],
    headLandedAt: landed,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /最新提交之后/);
});

test("截止时间不使用 git committer date 或评论的 updated_at", () => {
  const landed = headLandedAt([
    {
      event: "reviewed",
      submitted_at: "2026-11-14T12:30:00Z",
      updated_at: "2026-11-14T18:00:00Z",
    },
    { event: "committed", sha: "aaa", committer: { date: "2026-11-14T15:00:00Z" } },
    { event: "committed", sha: "bbb", committer: { date: "2026-11-14T09:00:00Z" } },
  ], "bbb");
  assert.equal(landed, "2026-11-14T12:30:00Z");
});

test("最新提交比所有带时间的事件都早时，之后的批准通过", () => {
  const landed = headLandedAt([
    { event: "committed", sha: "bbb", committer: { date: "2026-11-14T18:00:00Z" } },
  ], "bbb");
  assert.equal(landed, "1970-01-01T00:00:00Z");
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval, "2026-11-14T12:05:00Z")],
    headLandedAt: landed,
  });
  assert.equal(result.ok, true);
});

test("时间线没有最新提交时不通过", () => {
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval, "2026-11-14T12:05:00Z")],
    headLandedAt: headLandedAt([], "missing"),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /进入 Pull Request/);
});

test("同一提交再次进入后，更早的批准失效", () => {
  const landed = headLandedAt([
    { event: "committed", sha: "bbb" },
    { event: "commented", created_at: "2026-11-14T12:00:00Z" },
    { event: "head_ref_force_pushed", created_at: "2026-11-14T13:00:00Z" },
    { event: "committed", sha: "bbb" },
  ], "BBB");
  assert.equal(landed, "2026-11-14T13:00:00Z");
  const result = evaluateReview({
    body: "Author-Bot: Cursor",
    comments: [comment(approval, "2026-11-14T12:30:00Z")],
    headLandedAt: landed,
  });
  assert.equal(result.ok, false);
});
