# Ask "Me"

Digital Self 工作室的提问箱。仓库名是 `AI-Q-A-Box`。

这个仓库公开可阅读。提交只对所有者 **Yogdunana** 开放。四位成员是真人。他们用 WorkBuddy、Cursor、TRAE CN、ChatGPT Work 或其他 AI IDE，让 Bot 代为改代码。Bot 的规则写在 [`docs/ai-guide.md`](docs/ai-guide.md)。

前端在 [`web/`](web/)，说明见 [`web/README.md`](web/README.md)。后端在 [`server/`](server/)，说明见 [`server/README.md`](server/README.md)。前端默认仍用浏览器里的演示数据；把 `VITE_API_MODE` 设为 `http` 后才请求后端。产品规格在 [`docs/prd.md`](docs/prd.md)。规格里标成待确认的内容还不是产品决定。

## 文档

| 文档 | 用途 |
| --- | --- |
| [`docs/ai-guide.md`](docs/ai-guide.md) | 代执行 Bot 的身份、分支、PR、审核和合并规则 |
| [`docs/ai-guide-reference.md`](docs/ai-guide-reference.md) | 上述规则的逐步说明和权限细节 |
| [`docs/members.md`](docs/members.md) | 四位真人成员名册 |
| [`docs/deploy.md`](docs/deploy.md) | 生产服务器、域名和 HTTPS 证书 |
| [`docs/prd.md`](docs/prd.md) | 产品、设计和实现规格 |
| [`web/README.md`](web/README.md) | 前端架构、API 契约、设计系统和本地运行 |
| [`server/README.md`](server/README.md) | 后端 API、数据表、迁移、环境和本地运行 |

## 仓库权限

- 外部账号可以阅读。外部 Issue 和 Pull Request 会被 [`.github/workflows/reject-external.yml`](.github/workflows/reject-external.yml) 关闭。
- 功能分支从 `main` 拉出，用 Pull Request 合并。禁止直接推送 `main`。
- 只使用 squash merge。审核规则见 AI 开发规范。
- 所有者在本机执行 `GH_TOKEN=... scripts/lock-repository.sh`，把合并方式和 `main` 分支保护写到 GitHub。执行这项操作的令牌需要仓库管理权限。

## 本地检查

```bash
node --test scripts/member-review-check.test.mjs
```

前端：

```bash
cd web
npm install
npm run lint && npm run typecheck && npm test && npm run build
```

后端：

```bash
cd server
npm install
npm run typecheck && npm test
npm run dev
```

`npm run dev` 会在启动时执行数据库迁移，监听 `http://127.0.0.1:8787`。复制 `server/.env.example` 为 `server/.env` 后再填入本地密钥。生产环境还没有接入这个 API。

## 待确认事项

下面这些仍不是产品决定。后端先按可关闭的默认值跑起来，开关在 `server/.env.example`。

已采用的默认值：

1. 不自动公开回复。`PUBLIC_REPLIES_ENABLED` 默认关闭。箱主点了“公开发布”也不会进入公开页，接口会拒绝并保持草稿。
2. 不自动发送 AI 回复。模型输出只写入 `ai_generations`，状态停在草稿。没有生成后自动发布的路径。
3. 最小化收集提问者数据。不收集邮箱、账号或原始 IP。匿名开启时连称呼也不保存。反滥用只保留带密钥的哈希，默认 7 天后删除。
4. 提问者登录、邮件通知、管理员后台、举报处置、多提问箱、付费和多语言都没有实现。
5. 认证暂时是邮箱加密码，会话放在 HttpOnly Cookie。这是为了接上现有登录页。
6. 数据库暂时是本机 SQLite。PostgreSQL 和线上进程怎么跑，都还没定。当前生产发布只覆盖前端静态文件。
7. 每个账户先只有一个提问箱。
8. “私密发送”只把 `delivery_state` 记为 `private_reserved`。`sent_at` 是箱主确认的时间，不是送达时间。
9. 暂停中的提问箱仍然返回公开资料，`accepting` 为 false，提交会被拒绝。不存在和保留 slug 都返回同样的 404。页面上因此能显示暂停提示。
10. `AUTO_FLAG_RISK` 默认开启。明显的高风险内容会标成 `flagged`，并且不会把原文发给外部模型。

仍需产品决定：

1. 提问是否默认匿名，以及匿名对箱主和对平台分别是什么意思。
2. 提问者是否需要登录；不登录时如何查看私密回复。
3. 回答能否公开发布，公开范围是什么。当前开关默认关闭。
4. 认证、AI 模型、邮件、数据库和部署平台的正式选择。
5. 是否需要管理员后台、举报处置和团队协作。
6. 目标市场、隐私政策、数据保存期限、删除和导出。
7. Logo 源文件、品牌色、字体和使用规范。仓库里目前没有 Logo 文件。
8. 是否需要多语言、付费、数据导出、FAQ 公共页或社交分享卡片。
