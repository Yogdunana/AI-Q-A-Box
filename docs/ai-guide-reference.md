---
title: Ask "Me" AI 工作流程参考
version: 1.0.0
repository: Yogdunana/AI-Q-A-Box
source: 与 docs/ai-guide.md 一起使用。规则冲突时，以更严格的安全限制为准。
last_updated: 2026-11-14
---

# Ask "Me" AI 工作流程参考

本文件是 [`docs/ai-guide.md`](ai-guide.md) 的操作说明。产品需求以 [`docs/prd.md`](prd.md) 为准。

## 第 1 章：仓库与成员

### 1.1 仓库

| 项 | 值 |
| --- | --- |
| 仓库 | `Yogdunana/AI-Q-A-Box` |
| 产品名 | Ask "Me" |
| 归属 | Digital Self 工作室 |
| 默认分支 | `main` |
| 可见性 | 公开。因为空间和额度限制，不能改为私有 |
| 写权限 | 只有 GitHub 用户 `Yogdunana` |

### 1.2 四位成员

| 书写形式 | 角色 |
| --- | --- |
| `WorkBuddy` | 成员 Bot |
| `TRAE CN` | 成员 Bot |
| `ChatGPT Work` | 成员 Bot |
| `Cursor` | 成员 Bot，包括 Cursor 中的 Cloud Agent 与 Claude |

产品方若更换第四位的名称，同时修改 `docs/ai-guide.md` 的成员表和 `scripts/member-review-check.mjs` 里的 `MEMBERS`。两处必须一致，然后跑 `node --test scripts/member-review-check.test.mjs`。

四位成员的 Git 流程相同。本文件不给某一位单独的免审或直推 `main` 的例外。

### 1.3 GitHub 身份

所有 PR 的作者登录名必须是 `Yogdunana`。

能设置提交身份时：

```bash
git config user.name "Yogdunana"
git config user.email "106004584+Yogdunana@users.noreply.github.com"
```

只改本仓库配置。运行平台如果禁止修改提交身份，就保持平台身份，并在 PR 正文写 `Author-Bot`。

## 第 2 章：Git 工作流

### 2.1 分支

从最新的 `main` 建立功能分支。

WorkBuddy、TRAE CN、ChatGPT Work：

| 前缀 | 用途 |
| --- | --- |
| `feat/<short-desc>` | 新功能 |
| `fix/<short-desc>` | 缺陷修复 |
| `docs/<short-desc>` | 文档 |
| `chore/<short-desc>` | 工具、配置、依赖 |
| `refactor/<short-desc>` | 不改变行为的结构调整 |
| `test/<short-desc>` | 测试 |
| `ci/<short-desc>` | GitHub Actions |

描述使用小写英文和连字符。

Cursor Cloud Agent 使用当次任务指定的 `cursor/<描述>-<后缀>`。这是平台分支名，不要改成 `feat/`。

```bash
git checkout main
git pull origin main
git checkout -b docs/member-review-notes
```

### 2.2 提交说明

```text
<type>(<scope>): <description>
```

`type` 使用 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`、`perf`、`style`、`revert`。`scope` 可以省略。说明用一句说清结果。

一次提交做一件事。不要把密钥、本地环境和生成依赖提交进去。

### 2.3 打开 Pull Request

推送功能分支后打开 PR，目标分支是 `main`。使用仓库里的 PR 模板，填完每一段。

正文有且只有一行：

```text
Author-Bot: Cursor
```

值必须是第 1.2 节的四个名称之一。有对应 Issue 时写 `Fixes #编号`。没有 Issue 的文档或仓库初始化，写明没有 Issue 的原因。

标题使用与提交说明相同的格式。

### 2.4 审核

审核人是另一位成员，或所有者本人。作者不审核自己的 PR，也不代替别人填写 `Reviewer-Bot`。

审核人在 PR 上新发一条评论。下面两行各自单独成行，且各出现一次：

```text
Review-Decision: approve
Reviewer-Bot: TRAE CN
Reviewed-Head: 0123456789abcdef0123456789abcdef01234567
```

`Reviewed-Head` 是审核当时 PR 头部的完整 40 位提交 SHA，用 `git rev-parse HEAD` 或 PR 页面上的提交哈希取得。`Review-Decision` 只使用 `approve` 或 `request-changes`。`Reviewer-Bot` 使用四位成员名之一，或 `owner`。

通过条件：

1. 评论作者的 GitHub 登录名是 `Yogdunana`。
2. `Reviewed-Head` 与当前 PR 头部 SHA 一致。比较的是提交内容的标识，不是 git committer 时间。本地较早创建、在批准之后才推送的提交有另一个 SHA，旧批准不会覆盖它。
3. 针对该 SHA 的最新一条结论是 `approve`。
4. `Reviewer-Bot` 与 `Author-Bot` 不同。

推送新提交之后，头部 SHA 改变，旧评论失效，需要重新审核。

GitHub 的 Approve 按钮不能区分四位 Bot，因为他们共用 `Yogdunana` 这一个账号。分支保护里的“必需批准人数”保持为 0。跨成员审核以评论为准，由 `member-review` 检查。

检查命令：

```bash
node --test scripts/member-review-check.test.mjs
```

工作流 `.github/workflows/member-review.yml` 在 PR 打开、编辑、同步，以及新的评论出现时运行。它只检出默认分支上的脚本，不执行 PR 分支里的代码。

### 2.5 合并

`member-review` 通过，并且作者已经处理完 `request-changes` 之后，由 `Yogdunana` 账号执行：

```bash
gh pr merge <编号> --squash --delete-branch
```

合并后的提交进入 `main`。功能分支随仓库设置删除；设置尚未生效时，合并命令里的 `--delete-branch` 负责删除。

以下命令在本仓库禁止使用：

```bash
gh pr merge <编号> --merge
gh pr merge <编号> --rebase
gh pr merge <编号> --admin
```

禁止调用删除分支保护的 API。保护一直保持开启。DeployPilot 文档中“合并前临时解除保护”的步骤不能搬到本仓库。

合并后确认：

1. PR 状态是已合并，合并方式是 squash。
2. 功能分支已删除。
3. `main` 上的保护仍然开启。

### 2.6 Issue

成员用 `.github/ISSUE_TEMPLATE/member_task.md` 记录缺陷或需求。外部账号打开的 Issue 会被关闭，不作为任务来源。

## 第 3 章：公开仓库权限

### 3.1 已经由仓库文件执行的限制

| 机制 | 作用 |
| --- | --- |
| `.github/workflows/reject-external.yml` | 关闭非 `Yogdunana` 的 Issue，以及来自 Fork 或其他账号的 Pull Request。已经关闭的 PR 再次推送时不再重复留言 |
| `.github/workflows/member-review.yml` | 把成员审核结果写成 `member-review` 状态 |
| `.github/CODEOWNERS` | 标明所有者。不把它设成 GitHub 必需批准，避免同一账号无法批准自己的 PR |
| `.gitignore` | 忽略 `.env` 和环境文件 |

`reject-external` 使用 `pull_request_target`，只读取事件里的登录名和仓库名，不检出 PR 代码，也不运行 PR 里的脚本。

### 3.2 需要所有者令牌写入的限制

Cloud Agent 的安装令牌可以推送代码，没有仓库 administration 权限，不能修改分支保护和合并按钮。所有者在本机执行：

```bash
GH_TOKEN="<具有 administration 权限的令牌>" scripts/lock-repository.sh
```

脚本会：

1. 只保留 squash merge。
2. 关闭 merge commit 和 rebase merge。
3. 打开“合并后删除功能分支”。
4. 尝试关闭 Fork。个人公开仓库若不允许关闭 Fork，脚本记录失败并继续。外部仍然不能通过 Fork 把提交推进本仓库。
5. 为 `main` 打开分支保护：必须走 Pull Request，管理员也不能绕过，禁止强推，禁止删除分支。必需的 GitHub 批准人数是 0。

`member-review` 工作流已经在 `main` 上运行过之后，再把它列为必需检查：

```bash
GH_TOKEN="<具有 administration 权限的令牌>" scripts/lock-repository.sh --with-review-check
```

在工作流进入 `main` 之前就把它列为必需检查，会让第一批 PR 无法合并。

保护规则的意图如下。脚本会按这个意图调用 GitHub API；若“限制可推送用户”在当前账户类型上不可用，脚本改为只保留 PR、禁止强推和禁止删除。

```json
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": {
    "users": ["Yogdunana"],
    "teams": [],
    "apps": []
  },
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

也可以在 GitHub 网页完成同一组设置：

1. Settings → General → Pull Requests：只勾选 Allow squash merging，勾选 Automatically delete head branches。
2. Settings → Branches → Branch protection rule，分支名填 `main`。
3. 勾选 Require a pull request before merging。Required approvals 填 0。
4. 勾选 Do not allow bypassing the above settings。
5. 勾选 Do not allow force pushes 和 Do not allow deletions。
6. 不添加其他协作者。

### 3.3 协作者

协作者名单只保留 `Yogdunana`。不要把四位 Bot 加成独立的写权限账号，除非产品方提供了新的 GitHub 账号，并同时更新 `scripts/member-review-check.mjs` 的 `ALLOWED_LOGINS` 和拒绝外部提交的工作流。

## 第 4 章：产品实施边界

开始写应用之前先读 `docs/prd.md`。其中“已确认”部分必须遵守，“待确认 / TBD”部分不能写成已经决定的产品行为。

已确认且与协作直接相关的约束：

- 产品名是 Ask "Me"。
- 开屏页底部使用产品方提供的现有 Logo。仓库里还没有 Logo 文件时，停下来要文件，不另画一版。
- 开屏页不出现“AI帮箱主回复”“AI 代回复”“让 AI 替你回答”或同义说明。
- AI 草稿必须由箱主确认后才能发送或公开。

待确认清单以 README 和 `docs/prd.md` 第 16 节为准。认证方式、匿名、公开回复、模型供应商、部署平台、收费和数据保留期限都在这份清单里。

## 第 5 章：安全

- 密钥只放在环境变量或 GitHub Actions 的加密 Secret 中。
- 不在文档、工作流日志、截图和 PR 正文里粘贴令牌。`scripts/lock-repository.sh` 从 `GH_TOKEN` 读取令牌，不接受把令牌写进命令历史以外的文件。
- 用户提交的内容在将来的页面上按文本渲染。支持富文本之前先做白名单净化。
- 箱主数据的查询必须带所有者或提问箱归属。这个规则从第一行后端代码开始生效。
- 外部贡献不是安全审查的输入。关闭外部 PR，不把其中的补丁合并进来。

## 第 6 章：审查清单

审核人逐项看过再写 `approve`：

1. `Author-Bot` 只有一行，而且是四位成员之一。
2. 分支符合第 2.1 节，目标是 `main`。
3. diff 里没有 `.env`、密钥、令牌、连接串。
4. 没有把 TBD 写成已确认需求，没有替换 Logo，没有禁止的开屏文案。
5. 有测试或文档说明时，PR 的“验证”一节写了命令和结果。
6. 自己的 `Reviewer-Bot` 与作者不同。
7. `Reviewed-Head` 写成这次看到的 PR 头部完整 SHA。之后若有新提交，这条审核自动失效。

任一不满足，使用 `Review-Decision: request-changes`，并写上对应的 `Reviewed-Head`。

## 附录 A：命令

```bash
git checkout main
git pull origin main
git checkout -b docs/example-note
git status
git add docs/ai-guide.md
git commit -m "docs: 补充审核说明"
git push -u origin docs/example-note
gh pr create --base main --title "docs: 补充审核说明" --body-file /tmp/pr.md
gh pr merge <编号> --squash --delete-branch
node --test scripts/member-review-check.test.mjs
GH_TOKEN="<administration token>" scripts/lock-repository.sh
```

## 附录 B：已知限制

| 编号 | 限制 | 处理 |
| --- | --- | --- |
| 1 | 四位 Bot 共用 `Yogdunana`，GitHub 无法从账号区分是哪一位打的字 | 用 `Author-Bot` 和 `Reviewer-Bot`。成员不得冒用别人的名字 |
| 2 | Cloud Agent 安装令牌没有 administration 权限 | 所有者在本机执行 `scripts/lock-repository.sh` |
| 3 | 个人公开仓库可能无法关闭 Fork | Fork 仍然不能向本仓库推送。外部 PR 会被工作流关闭 |
| 4 | `member-review` 在进入 `main` 之前不会对已打开的 PR 生效 | 工作流合并进 `main` 后再执行 `--with-review-check` |
| 5 | 必需批准人数若设成 1，同一账号无法批准自己的 PR，所有 PR 都会卡住 | 保持为 0，审核由评论和工作流完成 |
