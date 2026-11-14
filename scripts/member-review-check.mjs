#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const MEMBERS = ["WorkBuddy", "TRAE CN", "ChatGPT Work", "Cursor"];
const REVIEWERS = new Set([...MEMBERS, "owner"]);
const ALLOWED_LOGINS = new Set(["Yogdunana"]);
const DECISIONS = new Set(["approve", "request-changes"]);

function fieldValues(text, field) {
  const pattern = new RegExp(`^${field}:\\s*(.*?)\\s*$`, "gm");
  return [...String(text ?? "").matchAll(pattern)].map((match) => match[1]);
}

// 截止时间是该提交最后一次出现在 PR 时间线之前的事件时间。
// git committer date 是本地提交时间，晚推送的旧提交会比它更早，不能用来判断审核是否还有效。
export function headLandedAt(events, headSha) {
  const sha = String(headSha ?? "").toLowerCase();
  if (!sha) return null;
  const list = Array.isArray(events) ? events : [];
  let index = -1;
  for (let i = 0; i < list.length; i++) {
    const event = list[i];
    if (event?.event === "committed" && String(event.sha ?? "").toLowerCase() === sha) {
      index = i;
    }
  }
  if (index < 0) return null;
  for (let i = index - 1; i >= 0; i--) {
    const event = list[i];
    const stamp = event?.created_at || event?.submitted_at;
    if (stamp) return stamp;
  }
  return "1970-01-01T00:00:00Z";
}

export function evaluateReview({ body, comments, headLandedAt: landedAt }) {
  const authors = fieldValues(body, "Author-Bot");
  if (authors.length !== 1) {
    const message = authors.length === 0
      ? "PR 正文缺少唯一的 Author-Bot 行"
      : "PR 正文有多条 Author-Bot";
    return { ok: false, errors: [message], authorBot: null, reviewerBot: null };
  }

  const authorBot = authors[0];
  if (!MEMBERS.includes(authorBot)) {
    return {
      ok: false,
      errors: [`Author-Bot「${authorBot}」不在四位成员内`],
      authorBot,
      reviewerBot: null,
    };
  }

  if (landedAt == null || landedAt === "") {
    return {
      ok: false,
      errors: ["无法确认最新提交何时进入 Pull Request"],
      authorBot,
      reviewerBot: null,
    };
  }

  const headTime = Date.parse(landedAt);
  if (Number.isNaN(headTime)) {
    return {
      ok: false,
      errors: ["无法解析最新提交时间"],
      authorBot,
      reviewerBot: null,
    };
  }

  const decisions = [];
  for (const comment of comments ?? []) {
    if (!ALLOWED_LOGINS.has(comment.userLogin)) continue;
    const created = Date.parse(comment.createdAt);
    if (Number.isNaN(created) || created <= headTime) continue;
    const decisionValues = fieldValues(comment.body, "Review-Decision");
    const reviewerValues = fieldValues(comment.body, "Reviewer-Bot");
    if (decisionValues.length !== 1 || reviewerValues.length !== 1) continue;
    if (!DECISIONS.has(decisionValues[0]) || !REVIEWERS.has(reviewerValues[0])) continue;
    decisions.push({
      decision: decisionValues[0],
      reviewerBot: reviewerValues[0],
      created,
    });
  }

  if (decisions.length === 0) {
    return {
      ok: false,
      errors: ["最新提交之后还没有另一位成员或 owner 的审核结论"],
      authorBot,
      reviewerBot: null,
    };
  }

  decisions.sort((left, right) => left.created - right.created);
  const latest = decisions[decisions.length - 1];
  if (latest.decision !== "approve") {
    return {
      ok: false,
      errors: ["最新审核结论是 request-changes"],
      authorBot,
      reviewerBot: latest.reviewerBot,
    };
  }
  if (latest.reviewerBot === authorBot) {
    return {
      ok: false,
      errors: ["审核人不能与 Author-Bot 是同一位"],
      authorBot,
      reviewerBot: latest.reviewerBot,
    };
  }

  return { ok: true, errors: [], authorBot, reviewerBot: latest.reviewerBot };
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

async function listPaged(token, path) {
  const items = [];
  let page = 1;
  for (;;) {
    const batch = await github(
      token,
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    items.push(...batch);
    if (batch.length < 100) return items;
    page += 1;
  }
}

export async function reviewPullRequest({ token, repo, number }) {
  const pull = await github(token, `/repos/${repo}/pulls/${number}`);
  const comments = await listPaged(token, `/repos/${repo}/issues/${number}/comments`);
  const timeline = await listPaged(token, `/repos/${repo}/issues/${number}/timeline`);
  const result = evaluateReview({
    body: pull.body,
    headLandedAt: headLandedAt(timeline, pull.head.sha),
    comments: comments.map((comment) => ({
      userLogin: comment.user?.login,
      body: comment.body,
      createdAt: comment.created_at,
    })),
  });
  const description = (result.ok
    ? `已由 ${result.reviewerBot} 审核`
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
    console.log(`member-review 通过：${result.authorBot} <- ${result.reviewerBot}`);
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
