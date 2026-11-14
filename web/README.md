# Ask "Me" 前端

`web/` 是 Ask "Me" 的前端应用：开屏页、公开提问页、箱主工作台（概览、收件箱、问题详情与 AI 草稿、分享、设置）以及登录注册。后端尚未开始，前端通过一层 API 契约与后端解耦，在后端就绪前使用浏览器本地的 mock 实现运行完整流程。

## 技术栈

| 选择 | 原因 |
| --- | --- |
| Vite + React 19 + TypeScript | 后端技术栈仍待确认（`docs/prd.md` §16）。纯静态 SPA 可以直接放进现有服务器的站点目录，不绑定任何后端框架 |
| React Router 8 | 路由与懒加载。箱主区页面按路由拆包，公开提问页不加载工作台代码 |
| `motion` | 页面进出场、列表增删、共享布局指示器（导航高亮、分段控件）、弹窗与 Toast。这些都需要卸载动画和布局动画，纯 CSS 做不到 |
| `lucide-react` | 统一线性图标，按需引入 |
| CSS Modules + 设计令牌 | 不引入 UI 组件库，所有组件按 Ask "Me" 自己的视觉语言实现 |
| Vitest + Testing Library / Playwright | 单元、组件与端到端测试 |
| oxlint | Vite 官方模板默认的 lint 工具 |

## 本地开发

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查并构建到 `dist/` |
| `npm run typecheck` | 只做类型检查 |
| `npm run lint` | oxlint |
| `npm test` | Vitest 单元与组件测试 |
| `npm run test:e2e` | Playwright 端到端测试（会自行启动开发服务器）。首次运行前执行 `npx playwright install chromium`；本机已装 Chrome 时可用 `PW_CHANNEL=chrome npm run test:e2e` |

## 环境变量

复制 `.env.example` 为 `.env.local`。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_MODE` | `mock`（默认）或 `http`。后端就绪后改为 `http` |
| `VITE_API_BASE_URL` | `http` 模式下的 API 根地址，默认同源 |

前端不持有任何密钥。AI 调用、提示词组装、限流都应在服务端完成（PRD §8.3、§11.2）。

## 路由

与 PRD §5.1 一致。

| 路由 | 页面 |
| --- | --- |
| `/` | 开屏页 |
| `/:slug` | 公开提问页 |
| `/:slug/submitted` | 提交成功 |
| `/auth/login`、`/auth/register` | 登录、注册 |
| `/app/setup` | 首次设置提问箱 |
| `/app` | 工作台概览 |
| `/app/inbox` | 收件箱。`?view=` 分类、`?q=` 搜索、`?selected=` 桌面端选中项 |
| `/app/questions/:id` | 问题详情（移动端从收件箱进入此页） |
| `/app/share` | 分享 |
| `/app/settings` | 设置 |

`/:slug` 与应用路由共用根路径，所以 `app`、`auth`、`api` 等地址被列为保留 slug（`src/lib/validation.ts`）。后端也需要拒绝这些 slug。

线上部署为 SPA 时，Web 服务器需要把未知路径回落到 `index.html`（Nginx：`try_files $uri /index.html;`）。本仓库没有修改任何部署配置。

## 目录

```text
src/
  api/            API 契约（types.ts）、HTTP 实现、mock 实现
  app/            路由表与路由守卫
  components/
    brand/        产品名与 Logo 占位
    layout/       应用外壳、页面容器、路由过渡
    ui/           Button、Field、Switch、SegmentedControl、Dialog、Menu、Toast 等
  config/         待产品确认事项的开关
  features/       按页面划分：landing、public-box、auth、setup、overview、inbox、question、share、settings
  lib/            动效参数、格式化、校验、状态机、轻量查询缓存
  state/          会话与 Toast
  styles/         设计令牌与全局样式
e2e/              Playwright 测试
```

## API 契约

`src/api/types.ts` 定义 `ApiClient` 接口，`src/api/http.ts` 按 PRD §10.1 实现。字段名沿用 PRD §9 的 snake_case。

| 方法 | 路径 | 来源 |
| --- | --- | --- |
| `GET` | `/api/me` | PRD（401 视为未登录） |
| `POST` | `/api/auth/login`、`/api/auth/register`、`/api/auth/logout` | PRD `/api/auth/*`，具体认证方式待定 |
| `PATCH` | `/api/me` | 前端补充：修改显示名称 |
| `GET` | `/api/boxes/{slug}` | PRD |
| `POST` | `/api/boxes/{slug}/questions` | PRD。请求体带 `idempotency_key` |
| `POST`、`PATCH` | `/api/me/boxes`、`/api/me/boxes/{id}` | PRD |
| `GET` | `/api/me/questions?status=a,b&q=` | PRD。前端需要响应里附带全部状态的 `counts` |
| `GET`、`PATCH` | `/api/me/questions/{id}` | PRD。`GET` 返回 `{ question, answer, generations }` |
| `DELETE` | `/api/me/questions/{id}` | 前端补充：软删除（PRD §4.4 的 `deleted`） |
| `POST` | `/api/me/questions/{id}/ai-drafts` | PRD |
| `DELETE` | `/api/me/questions/{id}/ai-drafts/{generationId}` | 前端补充：PRD §8.3 要求草稿可删除 |
| `POST` | `/api/me/questions/{id}/answers` | PRD |
| `PATCH` | `/api/me/answers/{id}` | PRD |
| `POST` | `/api/me/answers/{id}/publish` | PRD。请求体 `{ visibility }`，私密为发送、公开为发布 |
| `GET` | `/api/boxes/{slug}/answers` | 前端补充：公开回答列表（P1，受开关控制） |

需要后端确认的差异：

1. 标为“前端补充”的接口，以及 `counts`、`QuestionDetail` 的响应结构。
2. 提问箱上的 `reply_style`（语气、篇幅、语言、关于你），这是唯一会进入模型上下文的箱主资料。
3. 错误响应体 `{ message, fields }`，前端会把 `fields` 显示在对应输入框下。
4. 公开页 slug 不存在与已停用都返回 404，不区分（PRD §12）。

## Mock 模式

`src/api/mock/client.ts` 在浏览器里模拟后端规则：箱主数据隔离、slug 唯一、提交幂等、每分钟 5 次的提交限流、状态流转，以及 300–900ms 的网络延迟和 1.4–2.4s 的草稿生成时间。数据保存在 `localStorage`。

- 演示账号：登录页的“使用演示账号体验”，或 `demo@askme.local` / `askme-demo`。演示提问箱地址是 `/lin`。
- 模拟草稿失败：在控制台执行 `localStorage.setItem("askme:mock-fail-ai", "1")`。
- 重置数据：设置页底部的“重置演示数据”。
- mock 草稿用方括号留出需要箱主补充的内容，不编造箱主的经历（PRD §8.2）。

## 设计系统

令牌集中在 `src/styles/tokens.css`。

- 色彩：暖白纸色背景（`--paper`）与墨色文字（`--ink-1`…`--ink-4`）。品牌强调色是一种沉稳的朱红（`--accent`）。AI 草稿使用独立的靛蓝（`--ai`），保证它在视觉上永远不会和箱主自己的回复混在一起。正文对比度满足 WCAG AA。
- 字体：界面用系统无衬线字体（中文优先苹方 / 微软雅黑）。提问内容和展示性标题用衬线字体，像收到的一封信。这是 Ask "Me" 的主要视觉辨识点。
- 间距：4px 网格（`--space-*`）。圆角：输入和按钮 10px，卡片 14px，大面板 20px。
- 层级：多层低透明度阴影加 1px 描边，代替粗边框。
- 断点：640 / 768 / 1024 / 1280。小于 768 使用顶部栏加底部 Tab；768–1023 侧边栏收为图标栏；1024 起收件箱两栏；1280 起三栏。
- 触摸设备上可点区域不小于 44px，悬停样式只在支持悬停的设备上生效。

## 动效

参数在 `src/lib/motion.ts`，与 CSS 令牌同步。

| 用途 | 时长 / 曲线 |
| --- | --- |
| 按下、悬停 | 100–160ms，`ease-out` |
| 页面进入 | 220ms 淡入并上移 6px；离开 100ms 淡出 |
| 弹出层、菜单 | 160ms，从触发点缩放 0.97 → 1 |
| 指示器、开关 | 弹簧（stiffness 520 / damping 42），无可见回弹 |
| 弹窗 | 桌面居中缩放；小于 640px 改为底部抽屉 |
| AI 草稿 | 起草中显示呼吸点和骨架；结果逐字显现（读屏软件立即读到全文）；采用后回复框高亮一次 |

所有动画都尊重 `prefers-reduced-motion`：`MotionConfig reducedMotion="user"` 关闭位移，全局 CSS 把过渡缩短到 1ms，逐字显现和开屏演示直接显示最终状态。

## 待产品确认与已知限制

- **Logo**：仓库里还没有 Logo 文件，按仓库规则不绘制替代品。开屏页底部目前以文字显示产品名。拿到原始文件后放到 `public/brand/`，并设置 `src/components/brand/Brand.tsx` 里的 `BRAND_LOGO_SRC`。Favicon 同样暂缺。
- **品牌色**：`--accent` 是在没有 Logo 的情况下选定的临时强调色，拿到 Logo 后只需修改 `tokens.css`。
- **公开回答**：公开页的“公开的回答”受 `src/config/features.ts` 的 `publicAnswers` 控制（PRD P1，待确认）。
- **私密回复的送达方式**：提问者如何看到私密回复仍待确认，前端只记录“已私密回复”，不承诺通知提问者。
- **认证方式**：登录注册界面先按邮箱加密码实现，接口集中在 `ApiClient`，更换认证方式不影响页面结构。
- **深色模式、多语言**：未实现，令牌结构已为深色模式预留。
