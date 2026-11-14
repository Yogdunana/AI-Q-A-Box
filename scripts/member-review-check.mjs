#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TOOL_NAMES = new Set([
  "WorkBuddy",
  "Work Buddy",
  "Cursor",
  "TRAE CN",
  "ChatGPT Work",
  "owner",
]);
const ALLOWED_LOGINS = new Set(["Yogdunana"]);
const DECISIONS = new Set(["approve", "request-changes"]);
const SHA = /^[0-9a-f]{40}$/i;

export function rosterFromMarkdown(markdown) {
  return fieldValues(markdown, "Member").map((name) => name.trim()).filter((name) => name.length > 0);
}

function loadRoster() {
  try {
    return rosterFromMarkdown(readFileSync(new URL("../docs/members.md", import.meta.url), "utf8"));
  } catch {
    return [];
  }
}

function knownMember(name, roster) {
  if (name === "owner") return false;
  if (TOOL_NAMES.has(name)) return false;
  if (roster.length === 0) return true;
  return roster.includes(name);
}

function fieldValues(text, field) {
  const pattern = new RegExp(`^${field}:[^\\S\\n]*(.*?)[^\\S\\n]*$`, "gm");
  return [...String(text ?? "").matchAll(pattern)].map((match) => match[1]);
}

function blankIdentity(extra = {}) {
  return {
    ok: false,
    authorMember: null,
    authorTool: null,
    reviewerMember: null,
    ...extra,
  };
}

export function evaluateReview({ body, comments, headSha, roster = [] }) {
  const authorMembers = fieldValues(body, "Author-Member");
  const authorTools = fieldValues(body, "Author-Tool");
  if (authorMembers.length !== 1) {
    const message = authorMembers.length === 0
      ? "PR 正文缺少唯一的 Author-Member 行"
      : "PR 正文有多条 Author-Member";
    return blankIdentity({ errors: [message] });
  }
  if (authorTools.length !== 1 || authorTools[0].length === 0) {
    return blankIdentity({
      errors: ["PR 正文缺少唯一的 Author-Tool 行"],
      authorMember: authorMembers[0] || null,
    });
  }

  const authorMember = authorMembers[0];
  const authorTool = authorTools[0];
  if (!knownMember(authorMember, roster)) {
    const message = TOOL_NAMES.has(authorMember)
      ? `Author-Member「${authorMember}」是工具名，成员必须是真人`
      : `Author-Member「${authorMember}」不在真人名册内`;
    return blankIdentity({ errors: [message], authorMember, authorTool });
  }

  const normalizedHead = String(headSha ?? "").toLowerCase();
  if (!SHA.test(normalizedHead)) {
    return blankIdentity({ errors: ["无法确认当前提交 SHA"], authorMember, authorTool });
  }

  const decisions = [];
  let sawOtherHead = false;
  for (const comment of comments ?? []) {
    if (!ALLOWED_LOGINS.has(comment.userLogin)) continue;
    const decisionValues = fieldValues(comment.body, "Review-Decision");
    const reviewerMembers = fieldValues(comment.body, "Reviewer-Member");
    const reviewerTools = fieldValues(comment.body, "Reviewer-Tool");
    const headValues = fieldValues(comment.body, "Reviewed-Head");
    if (decisionValues.length !== 1 || reviewerMembers.length !== 1 || reviewerTools.length !== 1 || headValues.length !== 1) continue;
    if (!DECISIONS.has(decisionValues[0]) || reviewerTools[0].length === 0) continue;
    if (!SHA.test(headValues[0])) continue;
    const reviewerMember = reviewerMembers[0];
    const reviewerKnown = reviewerMember === "owner" || knownMember(reviewerMember, roster);
    if (!reviewerKnown) continue;
    const reviewedHead = headValues[0].toLowerCase();
    if (reviewedHead !== normalizedHead) {
      sawOtherHead = true;
      continue;
    }
    decisions.push({
      decision: decisionValues[0],
      reviewerMember,
      created: Date.parse(comment.createdAt) || 0,
    });
  }

  if (decisions.length === 0) {
    return blankIdentity({
      errors: [sawOtherHead
        ? "审核对应的提交不是当前最新提交"
        : "还没有另一位真人或 owner 对当前提交的审核结论"],
      authorMember,
      authorTool,
    });
  }

  decisions.sort((left, right) => left.created - right.created);
  const latest = decisions[decisions.length - 1];
  if (latest.decision !== "approve") {
    return blankIdentity({
      errors: ["当前提交的最新审核结论是 request-changes"],
      authorMember,
      authorTool,
      reviewerMember: latest.reviewerMember,
    });
  }
  if (latest.reviewerMember === authorMember) {
    return blankIdentity({
      errors: ["委托这次改动的真人不能审核自己"],
      authorMember,
      authorTool,
      reviewerMember: latest.reviewerMember,
    });
  }

  return {
    ok: true,
    errors: [],
    authorMember,
    authorTool,
    reviewerMember: latest.reviewerMember,
  };
}

async function github(token, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-q-a-box-member-review",
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || `GitHub API ${response.status}`);
  }
  return payload;
}

async function listComments(token, repo, number) {
  const comments = [];
  let page = 1;
  for (;;) {
    const batch = await github(
      token,
      `/repos/${repo}/issues/${number}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) return comments;
    page += 1;
  }
}

export async function reviewPullRequest({ token, repo, number }) {
  const pull = await github(token, `/repos/${repo}/pulls/${number}`);
  const comments = await listComments(token, repo, number);
  const result = evaluateReview({
    body: pull.body,
    headSha: pull.head.sha,
    roster: loadRoster(),
    comments: comments.map((comment) => ({
      userLogin: comment.user?.login,
      body: comment.body,
      createdAt: comment.created_at,
    })),
  });
  const description = (result.ok
    ? `已由 ${result.reviewerMember} 审核`
    : result.errors[0]
  ).slice(0, 140);
  const statusResponse = await fetch(
    `https://api.github.com/repos/${repo}/statuses/${pull.head.sha}`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ai-q-a-box-member-review",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        state: result.ok ? "success" : "failure",
        context: "member-review",
        description,
      }),
    },
  );
  if (!statusResponse.ok) {
    const statusPayload = await statusResponse.json().catch(() => ({}));
    throw new Error(statusPayload.message || `无法写入检查状态 ${statusResponse.status}`);
  }
  return result;
}

async function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo = process.env.REPO;
  const number = process.env.PR_NUMBER;
  if (!token || !repo || !number) {
    console.error("需要 GH_TOKEN、REPO 和 PR_NUMBER");
    process.exit(2);
  }
  const result = await reviewPullRequest({ token, repo, number });
  if (result.ok) {
    console.log(`member-review 通过：${result.authorMember} / ${result.authorTool} <- ${result.reviewerMember}`);
    return;
  }
  console.error(`member-review 未通过：${result.errors.join("；")}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
