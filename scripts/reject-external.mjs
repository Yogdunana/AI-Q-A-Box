#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { shouldCloseExternal } from "./reject-external-policy.mjs";

const NOTE = [
  "本仓库公开可阅读，提交只对所有者 Yogdunana 开放。",
  "外部 Issue 和 Pull Request 会被关闭。",
  "四位成员 Bot 请使用所有者账号在本仓库的功能分支上工作，规则见 docs/ai-guide.md。",
].join(" ");

async function github(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-q-a-box-reject-external",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.message || `GitHub API ${response.status}`);
  }
  return payload;
}

export async function rejectExternal({ token, repo, eventName, action, userLogin, sameRepo, state, number }) {
  const decision = shouldCloseExternal({ eventName, action, userLogin, sameRepo, state });
  if (!decision.close) return decision;

  if (decision.comment) {
    await github(token, `/repos/${repo}/issues/${number}/comments`, {
      method: "POST",
      body: { body: NOTE },
    });
  }

  if (eventName === "issues") {
    await github(token, `/repos/${repo}/issues/${number}`, {
      method: "PATCH",
      body: { state: "closed", state_reason: "not_planned" },
    });
  } else {
    await github(token, `/repos/${repo}/pulls/${number}`, {
      method: "PATCH",
      body: { state: "closed" },
    });
  }
  return decision;
}

async function main() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo = process.env.REPO;
  const number = process.env.ITEM_NUMBER;
  if (!token || !repo || !number) {
    console.error("需要 GH_TOKEN、REPO 和 ITEM_NUMBER");
    process.exit(2);
  }
  const decision = await rejectExternal({
    token,
    repo,
    eventName: process.env.EVENT_NAME,
    action: process.env.ACTION,
    userLogin: process.env.USER_LOGIN,
    sameRepo: process.env.SAME_REPO === "true",
    state: process.env.ITEM_STATE,
    number,
  });
  console.log(decision.close ? "已关闭外部提交" : "无需关闭");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
