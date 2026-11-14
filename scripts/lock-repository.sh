#!/usr/bin/env bash
# 由仓库所有者在本机执行。需要具有仓库 administration 权限的令牌。
# 用法：GH_TOKEN=... scripts/lock-repository.sh
# 工作流已经在 main 上稳定运行后，再执行：
# GH_TOKEN=... scripts/lock-repository.sh --with-review-check
set -euo pipefail

repo="${REPO:-Yogdunana/AI-Q-A-Box}"
token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
with_review_check=0

if [[ "${1:-}" == "--with-review-check" ]]; then
  with_review_check=1
elif [[ -n "${1:-}" ]]; then
  echo "未知参数：$1" >&2
  exit 2
fi

if [[ -z "$token" ]]; then
  echo "需要 GH_TOKEN 或 GITHUB_TOKEN，且该令牌具备仓库 administration 权限。" >&2
  exit 2
fi

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response
  if [[ -n "$body" ]]; then
    response="$(curl -sS -w $'\n%{http_code}' -X "$method" \
      -H "Authorization: Bearer ${token}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      -H "Content-Type: application/json" \
      "https://api.github.com${path}" \
      -d "$body")"
  else
    response="$(curl -sS -w $'\n%{http_code}' -X "$method" \
      -H "Authorization: Bearer ${token}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com${path}")"
  fi
  local status="${response##*$'\n'}"
  local payload="${response%$'\n'*}"
  printf '%s\n' "$status"
  printf '%s\n' "$payload"
}

echo "更新合并方式：只保留 squash，合并后删除分支"
mapfile -t merge_result < <(api PATCH "/repos/${repo}" "$(cat <<'JSON'
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "delete_branch_on_merge": true,
  "allow_auto_merge": false
}
JSON
)")
echo "合并方式 HTTP ${merge_result[0]}"
if [[ "${merge_result[0]}" != "200" ]]; then
  printf '%s\n' "${merge_result[@]:1}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("message","失败"))'
  if [[ "${merge_result[0]}" == "403" || "${merge_result[0]}" == "401" ]]; then
    echo "当前令牌没有仓库管理权限。请所有者用自己的个人访问令牌在本机执行本脚本，或按 docs/ai-guide-reference.md 第 3.2 节在 GitHub 网页上设置。不要把令牌贴进对话、文档或日志。"
  fi
  exit 1
fi

echo "尝试关闭 Fork。个人公开仓库可能不支持，失败时保留公开可读。"
mapfile -t fork_result < <(api PATCH "/repos/${repo}" '{"allow_forking": false}')
echo "Fork 设置 HTTP ${fork_result[0]}"
if [[ "${fork_result[0]}" != "200" ]]; then
  printf '%s\n' "${fork_result[@]:1}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("message","未能关闭 Fork"))'
fi

checks="null"
if [[ "$with_review_check" -eq 1 ]]; then
  checks='{"strict": true, "contexts": ["member-review"]}'
fi

protection="$(cat <<JSON
{
  "required_status_checks": ${checks},
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0,
    "require_last_push_approval": false
  },
  "restrictions": {
    "users": ["Yogdunana"],
    "teams": [],
    "apps": []
  },
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
)"

echo "写入 main 分支保护"
mapfile -t protect_result < <(api PUT "/repos/${repo}/branches/main/protection" "$protection")
echo "分支保护 HTTP ${protect_result[0]}"
if [[ "${protect_result[0]}" != "200" ]]; then
  echo "带推送名单的保护未生效，改为只强制 PR、禁止强推和删除。"
  protection="$(cat <<JSON
{
  "required_status_checks": ${checks},
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
)"
  mapfile -t protect_result < <(api PUT "/repos/${repo}/branches/main/protection" "$protection")
  echo "分支保护回退 HTTP ${protect_result[0]}"
  if [[ "${protect_result[0]}" != "200" ]]; then
    printf '%s\n' "${protect_result[@]:1}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("message","失败"))'
    exit 1
  fi
fi

echo "仓库锁定完成。外部账号没有写权限；main 不能直接推送。"
