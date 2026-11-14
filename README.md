# Ask "Me"

Digital Self 工作室的提问箱。仓库名是 `AI-Q-A-Box`。

这个仓库公开可阅读。提交只对所有者 **Yogdunana** 开放。四位成员 Bot（WorkBuddy、TRAE CN、ChatGPT Work、Cursor）通过该账号工作，规则写在 [`docs/ai-guide.md`](docs/ai-guide.md)。

应用代码还没有开始。产品规格在 [`docs/prd.md`](docs/prd.md)。规格里标成待确认的内容还不是产品决定。

## 文档

| 文档 | 用途 |
| --- | --- |
| [`docs/ai-guide.md`](docs/ai-guide.md) | 成员 Bot 的分支、PR、审核和合并规则 |
| [`docs/ai-guide-reference.md`](docs/ai-guide-reference.md) | 上述规则的逐步说明和权限细节 |
| [`docs/prd.md`](docs/prd.md) | 产品、设计和实现规格 |

## 仓库权限

- 外部账号可以阅读。外部 Issue 和 Pull Request 会被 [`.github/workflows/reject-external.yml`](.github/workflows/reject-external.yml) 关闭。
- 功能分支从 `main` 拉出，用 Pull Request 合并。禁止直接推送 `main`。
- 只使用 squash merge。审核规则见 AI 开发规范。
- 所有者在本机执行 `GH_TOKEN=... scripts/lock-repository.sh`，把合并方式和 `main` 分支保护写到 GitHub。执行这项操作的令牌需要仓库管理权限。

## 本地检查

```bash
node --test scripts/member-review-check.test.mjs
```

## 待产品确认

实现功能之前，这些事项仍待产品方确认：

1. 提问是否默认匿名，以及匿名对箱主和对平台分别是什么意思。
2. 提问者是否需要登录；不登录时如何查看私密回复。
3. 回答能否公开发布，公开范围是什么。
4. 认证、AI 模型、邮件、数据库和部署平台。
5. 是否需要管理员后台、举报处置和团队协作。
6. 目标市场、隐私政策、数据保存期限、删除和导出。
7. Logo 源文件、品牌色、字体和使用规范。仓库里目前没有 Logo 文件。
8. 是否需要多语言、付费、数据导出、FAQ 公共页或社交分享卡片。
