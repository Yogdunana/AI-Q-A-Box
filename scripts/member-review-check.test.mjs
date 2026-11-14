import assert from "node:assert/strict";
import test from "node:test";
import { evaluateReview, rosterFromMarkdown } from "./member-review-check.mjs";

const head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const other = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function comment(body, createdAt, userLogin = "Yogdunana") {
  return { userLogin, body, createdAt };
}

function body(member = "甲", tool = "Cursor") {
  return `Author-Member: ${member}\nAuthor-Tool: ${tool}\n\n说明`;
}

function approval({
  sha = head,
  reviewer = "乙",
  tool = "WorkBuddy",
  decision = "approve",
} = {}) {
  return `Review-Decision: ${decision}
Reviewer-Member: ${reviewer}
Reviewer-Tool: ${tool}
Reviewed-Head: ${sha}

结论。`;
}

test("缺少 Author-Member 时不通过", () => {
  const result = evaluateReview({
    body: "Author-Tool: Cursor",
    comments: [comment(approval())],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Author-Member/);
});

test("缺少 Author-Tool 时不通过", () => {
  const result = evaluateReview({
    body: "Author-Member: 甲",
    comments: [comment(approval())],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Author-Tool/);
});

test("工具名不能当作真人成员", () => {
  const result = evaluateReview({
    body: body("Cursor", "Cursor"),
    comments: [],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /工具名/);
});

test("另一位真人批准当前提交则通过", () => {
  const result = evaluateReview({
    body: body(),
    comments: [comment(approval())],
    headSha: head,
  });
  assert.deepEqual(result, {
    ok: true,
    errors: [],
    authorMember: "甲",
    authorTool: "Cursor",
    reviewerMember: "乙",
  });
});

test("同一个工具被另一位真人使用时可以审核", () => {
  const result = evaluateReview({
    body: body("甲", "Cursor"),
    comments: [comment(approval({ reviewer: "乙", tool: "Cursor" }))],
    headSha: head,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reviewerMember, "乙");
});

test("委托人不能审核自己", () => {
  const result = evaluateReview({
    body: body("甲", "Cursor"),
    comments: [comment(approval({ reviewer: "甲", tool: "WorkBuddy" }))],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /不能审核自己/);
});

test("所有者可以要求合并", () => {
  const result = evaluateReview({
    body: body("甲", "TRAE CN"),
    comments: [comment(approval({ reviewer: "owner", tool: "Cursor" }))],
    headSha: head,
  });
  assert.equal(result.ok, true);
  assert.equal(result.reviewerMember, "owner");
});

test("指向其他提交的批准不能覆盖当前提交", () => {
  const result = evaluateReview({
    body: body(),
    comments: [comment(approval({ sha: other }))],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /不是当前最新提交/);
});

test("外部账号的批准无效", () => {
  const result = evaluateReview({
    body: body(),
    comments: [comment(approval(), "2026-11-14T13:00:00Z", "outsider")],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /还没有/);
});

test("当前提交上最新的 request-changes 覆盖更早的 approve", () => {
  const result = evaluateReview({
    body: body(),
    comments: [
      comment(approval(), "2026-11-14T12:10:00Z"),
      comment(approval({ reviewer: "丙", decision: "request-changes" }), "2026-11-14T12:20:00Z"),
    ],
    headSha: head,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /request-changes/);
});

test("名册启用后只接受名册中的真人", () => {
  const roster = ["甲", "乙"];
  const missing = evaluateReview({
    body: body("丁"),
    comments: [comment(approval())],
    headSha: head,
    roster,
  });
  assert.match(missing.errors[0], /不在真人名册内/);
  const listed = evaluateReview({
    body: body("甲"),
    comments: [comment(approval({ reviewer: "乙" }))],
    headSha: head,
    roster,
  });
  assert.equal(listed.ok, true);
});

test("名册从 Member 行读取，空行忽略", () => {
  assert.deepEqual(rosterFromMarkdown("说明\nMember: 甲\nMember: \nMember: 乙\n"), ["甲", "乙"]);
});

test("其他 AI IDE 的工具名可以填写", () => {
  const result = evaluateReview({
    body: body("甲", "其他 IDE"),
    comments: [comment(approval({ tool: "其他 IDE" }))],
    headSha: head,
  });
  assert.equal(result.ok, true);
  assert.equal(result.authorTool, "其他 IDE");
});
