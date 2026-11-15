# Ask "Me" 后端

`server/` 实现前端 `web/src/api/http.ts` 里的 REST 契约。前端默认仍走浏览器里的 mock；把 `web/.env.local` 的 `VITE_API_MODE` 改成 `http` 后，才会请求这里。

技术选择沿用仓库现有的 TypeScript，而不是把已经完成的 Vite SPA 改成别的全栈框架。HTTP 用 Fastify。数据用 Node 22 自带的 `node:sqlite`，迁移是 `migrations/` 里的 SQL 文件。这样本地测试不需要另起数据库，也符合当前单机部署。PostgreSQL 仍然是待确认项。`node:sqlite` 在 Node 22 里还标着实验接口，启动脚本带了 `--experimental-sqlite`。

## 本地运行

需要 Node.js 22.13 或更新。

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

开发服务监听 `http://127.0.0.1:8787`。进程启动时会自己跑迁移。也可以单独执行：

```bash
npm run migrate
npm run typecheck
npm test
npm start
```

`.env` 不要提交。`.env.example` 里的 `SESSION_SECRET` 和 `IP_HASH_PEPPER` 是占位符，生产环境拒绝仍然包含 `replace-with` 的值。

前端一起跑时：

```bash
# web/.env.local
VITE_API_MODE=http
VITE_API_BASE_URL=
```

Vite 把 `/api` 代理到 `127.0.0.1:8787`。也可以把 `VITE_API_BASE_URL` 写成 `http://127.0.0.1:8787`，浏览器跨端口访问时要靠 `WEB_ORIGINS` 和 Cookie。

## 数据表

| 表 | 作用 |
| --- | --- |
| `users` | 箱主账户。密码只存 scrypt 哈希 |
| `sessions` | 会话令牌的 HMAC，不存原始 Cookie |
| `question_boxes` | 提问箱。`slug` 唯一，一个账户先只有一个箱子 |
| `questions` | 问题。删除是把状态改成 `deleted` |
| `question_idempotency` | 提交幂等键，范围是单个箱子 |
| `submission_guards` | 短时间去重和反滥用。只存内容哈希和 IP 哈希，默认 7 天后删除 |
| `answers` | 回复草稿和交付状态 |
| `ai_generations` | 模型输出。只作为草稿保存 |
| `audit_logs` | 最小化审计。不写问题原文、邮箱、密码、提示词或模型输出 |
| `rate_hits` | 速率限制计数 |
| `schema_migrations` | 已执行的迁移文件名 |

回复状态在 `answers.delivery_state`：

| 状态 | 含义 |
| --- | --- |
| `draft` | 已保存，未确认。`published_at` 和 `sent_at` 都是空的 |
| `private_reserved` | 箱主确认了私密回复。`sent_at` 是确认时间，不是送达时间。没有收集提问者联系方式，所以不会发邮件 |
| `published` | 箱主确认了公开发布。公开页只在 `PUBLIC_REPLIES_ENABLED=true` 时读 `published_content` |

保存或编辑草稿不会改 `published_content`。已经公开的文字要等箱主再次确认发布才会更新。

问题状态沿用前端：`submitted`、`reviewing`、`drafted`、`answered_private`、`published`、`archived`、`spam`、`flagged`、`deleted`。生成草稿或保存回复不会自动进入后四个交付状态。

## API

错误体是 `{ message, fields }`。`fields` 只在能对应到输入框时出现。

| 方法 | 路径 | 谁可以调用 |
| --- | --- | --- |
| `GET` | `/api/health` | 任何人。只返回 `{ ok: true }` |
| `POST` | `/api/auth/register` | 任何人。成功后写 HttpOnly Cookie |
| `POST` | `/api/auth/login` | 任何人。邮箱不存在和密码错误是同一句提示 |
| `POST` | `/api/auth/logout` | 当前会话。没有会话也返回 204 |
| `GET` | `/api/me` | 箱主。没有会话时 401 |
| `PATCH` | `/api/me` | 箱主。只改显示名称 |
| `GET` | `/api/boxes/:slug` | 任何人。不存在和保留 slug 都是同样的 404 |
| `GET` | `/api/boxes/:slug/answers` | 任何人。公开开关关闭时，存在的箱子返回 `[]` |
| `POST` | `/api/boxes/:slug/questions` | 任何人。暂停的箱子返回 403 |
| `POST` | `/api/me/boxes` | 箱主。第二个箱子返回 409 |
| `PATCH` | `/api/me/boxes/:id` | 只有这个箱子的箱主 |
| `GET` | `/api/me/questions?status=&q=` | 箱主。`counts` 统计自己箱子里未删除的问题 |
| `GET` | `/api/me/questions/:id` | 箱主。返回 `{ question, answer, generations }` |
| `PATCH` | `/api/me/questions/:id` | 箱主。归档、垃圾、需留意和恢复 |
| `DELETE` | `/api/me/questions/:id` | 箱主。软删除 |
| `POST` | `/api/me/questions/:id/ai-drafts` | 箱主。只在服务端调用模型 |
| `DELETE` | `/api/me/questions/:id/ai-drafts/:generationId` | 箱主 |
| `POST` | `/api/me/questions/:id/answers` | 箱主。保存草稿，不公开、不发送 |
| `PATCH` | `/api/me/answers/:id` | 箱主。编辑草稿 |
| `POST` | `/api/me/answers/:id/publish` | 箱主。`{ visibility: "private" \| "public" }` |

别人的箱子、问题和草稿一律 404，不说明资源是否存在。公开页不返回邮箱、`owner_id`、回复风格或内部 id。

Cookie 名是 `askme_session`，`HttpOnly`、`SameSite=Lax`。生产环境默认再加 `Secure`。变更请求如果带了不在 `WEB_ORIGINS` 里的 `Origin`，直接 403。

AI 密钥、数据库路径和会话密钥只出现在服务端环境变量里。模型失败时返回固定的 503 文案，响应里不带上游错误。高风险问题不会发给外部模型，只给箱主一条待核对的本地草稿，并把问题标成 `flagged`。

## 尚未接到生产

`.github/workflows/deploy-web.yml` 仍然只发布前端静态文件。这台服务器上的 Nginx 还没有把 `/api` 反代过来。接入时再由所有者修改服务器配置，例如让本机 Nginx 把 `/api/` 转到 `127.0.0.1:8787`，并设置：

```text
NODE_ENV=production
HOST=127.0.0.1
COOKIE_SECURE=true
TRUST_PROXY=true
WEB_ORIGINS=https://ai-box.yogdunana.cn
PUBLIC_REPLIES_ENABLED=false
```

`TRUST_PROXY=true` 只信任来自 `127.0.0.1` 的反向代理。不要把后端端口直接暴露到公网。不要把 `.env`、SQLite 文件或密钥放进 `/var/www/ai-box`。
