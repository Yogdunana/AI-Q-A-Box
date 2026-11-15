# Ask "Me"

Digital Self 工作室的提问箱。仓库名是 `AI-Q-A-Box`。

这个仓库公开可阅读。提交只对所有者 **Yogdunana** 开放。四位成员是真人。他们用 WorkBuddy、Cursor、TRAE CN、ChatGPT Work 或其他 AI IDE，让 Bot 代为改代码。Bot 的规则写在 [`docs/ai-guide.md`](docs/ai-guide.md)。

前端在 [`web/`](web/)，说明见 [`web/README.md`](web/README.md)。后端在 [`server/`](server/)，说明见 [`server/README.md`](server/README.md)。本地开发默认可以用浏览器里的演示数据；`VITE_APP_INTENT=development` 且 `VITE_API_MODE=http` 时请求后端。生产构建必须显式使用真实 API。产品规格在 [`docs/prd.md`](docs/prd.md)。下面没有改写的待确认项仍然不是产品决定。

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
npm run lint && npm run typecheck && npm test
VITE_APP_INTENT=production VITE_API_MODE=http npm run build
```

后端：

```bash
cd server
npm install
npm run typecheck && npm test
npm run dev
```

`npm run dev` 会在启动时执行数据库迁移，监听 `http://127.0.0.1:8787`。复制 `server/.env.example` 为 `server/.env` 后再填入本地密钥。生产进程还没有由这个仓库直接发布，接入步骤见 [`docs/deploy.md`](docs/deploy.md)。

## 待确认事项

下面这些仍不是产品决定。后端先按可关闭的默认值跑起来，开关在 `server/.env.example`。

这一版按委托人确认的行为实现：

1. 提问可以不向箱主留下称呼。匿名只对箱主隐藏称呼。平台仍保留防滥用所需的内容哈希和 IP 哈希，默认 7 天后删除这些记录。
2. 提问者不注册。提交后得到高熵查看链接，用来查看自己的问题和箱主已经确认的回复快照。服务端只保存凭证摘要。链接丢失后不能补发，也不发邮件或短信。
3. 公开发布默认关闭。即使打开 `PUBLIC_REPLIES_ENABLED`，也必须有提问者提交时的明确授权。箱主确认不能代替这个授权。没有授权的旧问题不能公开。
4. 私密确认写入 `confirmed_content` 快照。`sent_at` 仍是确认时间，不是送达时间。提问者打开快照后才记录 `seen_at`。未实现的送达状态不会展示。旧的 `private_reserved` 记录不会在迁移时变成已读或可查看快照。
5. 不自动发送 AI 回复。模型输出先写入草稿。生成返回后会再检查问题是否仍可写入，已删除、归档或标为垃圾的问题不会被旧任务改回去。
6. 认证暂时是邮箱加密码，会话放在 HttpOnly Cookie。数据库暂时是本机 SQLite。PostgreSQL 仍待确认。

仍需产品决定：

1. 数据保存期限、删除和导出的正式政策。防滥用哈希目前默认保留 7 天。
2. 邮件或短信通知是否以后要做。这一版明确不做。
3. 认证、模型和数据库的长期供应商选择。
4. 是否需要管理员后台、举报处置和团队协作。
5. 目标市场和隐私政策的法律文本。
6. Logo 源文件、品牌色、字体和使用规范。仓库里目前没有 Logo 文件。
7. 是否需要多语言、付费、数据导出、FAQ 公共页或社交分享卡片。
