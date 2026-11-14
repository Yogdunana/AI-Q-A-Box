import assert from "node:assert/strict";
import test from "node:test";
import { shouldCloseExternal } from "./reject-external-policy.mjs";

test("所有者在本仓库的 PR 保持打开", () => {
  assert.deepEqual(shouldCloseExternal({
    eventName: "pull_request_target",
    action: "opened",
    userLogin: "Yogdunana",
    sameRepo: true,
    state: "open",
  }), { close: false, comment: false });
});

test("外部 PR 会被关闭并留言", () => {
  assert.deepEqual(shouldCloseExternal({
    eventName: "pull_request_target",
    action: "opened",
    userLogin: "someone",
    sameRepo: false,
    state: "open",
  }), { close: true, comment: true });
});

test("已关闭的外部 PR 再次推送不再留言", () => {
  assert.deepEqual(shouldCloseExternal({
    eventName: "pull_request_target",
    action: "synchronize",
    userLogin: "someone",
    sameRepo: false,
    state: "closed",
  }), { close: false, comment: false });
});

test("外部 PR 被重新打开时再次关闭", () => {
  assert.deepEqual(shouldCloseExternal({
    eventName: "pull_request_target",
    action: "reopened",
    userLogin: "someone",
    sameRepo: false,
    state: "open",
  }), { close: true, comment: true });
});

test("所有者从 Fork 提交仍会关闭", () => {
  assert.deepEqual(shouldCloseExternal({
    eventName: "pull_request_target",
    action: "opened",
    userLogin: "Yogdunana",
    sameRepo: false,
    state: "open",
  }), { close: true, comment: true });
});

test("所有者的 Cursor Bot 可以在本仓库建 Issue 和 PR", () => {
  assert.equal(shouldCloseExternal({
    eventName: "issues",
    action: "opened",
    userLogin: "cursor[bot]",
    sameRepo: false,
    state: "open",
  }).close, false);
  assert.equal(shouldCloseExternal({
    eventName: "pull_request_target",
    action: "opened",
    userLogin: "cursor[bot]",
    sameRepo: true,
    state: "open",
  }).close, false);
  assert.equal(shouldCloseExternal({
    eventName: "pull_request_target",
    action: "opened",
    userLogin: "cursor[bot]",
    sameRepo: false,
    state: "open",
  }).close, true);
});

test("外部 Issue 会关闭，所有者 Issue 保持打开", () => {
  assert.equal(shouldCloseExternal({
    eventName: "issues",
    action: "opened",
    userLogin: "someone",
    sameRepo: false,
    state: "open",
  }).close, true);
  assert.equal(shouldCloseExternal({
    eventName: "issues",
    action: "opened",
    userLogin: "Yogdunana",
    sameRepo: false,
    state: "open",
  }).close, false);
});
