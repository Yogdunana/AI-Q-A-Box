#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const REQUEST = /^Review-Request:[^\S\n]*owner[^\S\n]*$/m;

export function hasReviewRequest(comments) {
  return (comments ?? []).some((comment) => REQUEST.test(String(comment.body ?? "")));
}

export function reminderBody() {
  return [
    "Review-Request: owner",
    "请所有者调用 agent 审核这个 PR。执行这次改动的 Bot 不要自行审核。",
    "",
  ].join("\n");
}

async function github(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-q-a-box-review-request",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
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

export async function ensureReviewRequest({ token, repo, number }) {
  const comments = await listComments(token, repo, number);
  if (hasReviewRequest(comments.map((comment) => ({ body: comment.body })))) {
    return { posted: false };
  }
  await github(token, `/repos/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: reminderBody() }),
  });
  return { posted: true };
}

async function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo = process.env.REPO;
  const number = process.env.PR_NUMBER;
  if (!token || !repo || !number) {
    console.error("需要 GH_TOKEN、REPO 和 PR_NUMBER");
    process.exit(2);
  }
  const result = await ensureReviewRequest({ token, repo, number });
  console.log(result.posted ? "已提醒所有者调用审核 agent" : "提醒已存在，不再重复发送");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
