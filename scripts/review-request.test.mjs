import assert from "node:assert/strict";
import test from "node:test";
import { hasReviewRequest, reminderBody } from "./review-request.mjs";

test("没有提醒时需要发送", () => {
  assert.equal(hasReviewRequest([]), false);
  assert.equal(hasReviewRequest([{ body: "普通评论" }]), false);
});

test("已有 owner 提醒时不再发送", () => {
  assert.equal(hasReviewRequest([{ body: reminderBody() }]), true);
  assert.equal(hasReviewRequest([{ body: "说明\nReview-Request: owner\n" }]), true);
});

test("提醒正文不包含审核结论", () => {
  assert.match(reminderBody(), /Review-Request: owner/);
  assert.doesNotMatch(reminderBody(), /Review-Decision/);
  assert.doesNotMatch(reminderBody(), /Reviewed-Head/);
});
