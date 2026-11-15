# Ask "Me" 前端

`web/` 是 Ask "Me" 的前端应用：开屏页、公开提问页、提交后的查看链接、回复查看页、箱主工作台（概览、收件箱、问题详情与 AI 草稿、分享、设置）以及登录注册。后端在 [`server/`](../server/)。

运行意图有三种。`development` 默认用浏览器里的 mock，也可以改成 `http`。`demo` 只能用 mock，并且页面上一直有演示标识。`production` 必须是 `http`。生产构建如果没有这个配置会失败，不会悄悄退回 mock。

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
| `npm run build` | 类型检查并构建。生产构建需要 `VITE_APP_INTENT=production` 和 `VITE_API_MODE=http` |
| `npm run test:e2e:live` | 用真实后端、隔离的 SQLite 和模型替身跑两个浏览器的联调 |
| `npm run typecheck` | 只做类型检查 |
| `npm run lint` | oxlint |
| `npm test` | Vitest 单元与组件测试 |
| `npm run test:e2e` | Playwright 端到端测试（会自行启动开发服务器）。首次运行前执行 `npx playwright install chromium`；本机已装 Chrome 时可用 `PW_CHANNEL=chrome npm run test:e2e` |

## 环境变量

复制 `.env.example` 为 `.env.local`。

| 变量 | 说明 |
| --- | --- |
| `VITE_APP_INTENT` | `development`、`demo` 或 `production` |
| `VITE_API_MODE` | `mock` 或 `http`。生产必须是 `http` |
| `VITE_API_BASE_URL` | `http` 模式下的 API 根地址。留空时走同源 `/api`，开发服务器会代理到 `127.0.0.1:8787` |

前端不持有任何密钥。AI 调用、提示词组装、限流都应在服务端完成（PRD §8.3、§11.2）。

## 路由

与 PRD §5.1 一致。

| 路由 | 页面 |
| --- | --- |
| `/` | 开屏页 |
| `/:slug` | 公开提问页 |
| `/:slug/submitted` | 提交成功，并给出查看链接 |
| `/reply` | 用链接里的片段凭证查看自己的问题和已确认回复。凭证不进入查询字符串 |
| `/auth/login`、`/auth/register` | 登录、注册 |
| `/app/setup` | 首次设置提问箱 |
| `/app` | 工作台概览 |
| `/app/inbox` | 收件箱。`?view=` 分类、`?q=` 搜索、`?selected=` 桌面端选中项 |
| `/app/questions/:id` | 问题详情（二级页面；不分栏时从收件箱推入） |
| `/app/share` | 分享 |
| `/app/settings` | 设置。手机上是分区列表；平板和桌面上自动进入第一个分区 |
| `/app/settings/profile`、`box`、`style`、`account` | 设置分区（手机上是二级页面） |

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
| `GET` | `/api/capabilities` | 前端据此决定是否显示公开发布，不自己硬编码开关 |
| `POST` | `/api/boxes/{slug}/questions` | 请求体带 `idempotency_key` 和 `view_token`。幂等键不能用来读取回复 |
| `POST` | `/api/reply-access` | 请求体 `{ token }`。只返回该提问者的问题和已确认快照 |
| `POST`、`PATCH` | `/api/me/boxes`、`/api/me/boxes/{id}` | PRD |
| `GET` | `/api/me/questions?status=a,b&q=` | PRD。前端需要响应里附带全部状态的 `counts` |
| `GET`、`PATCH` | `/api/me/questions/{id}` | PRD。`GET` 返回 `{ question, answer, generations }` |
| `DELETE` | `/api/me/questions/{id}` | 前端补充：软删除（PRD §4.4 的 `deleted`） |
| `POST` | `/api/me/questions/{id}/ai-drafts` | PRD |
| `DELETE` | `/api/me/questions/{id}/ai-drafts/{generationId}` | 前端补充：PRD §8.3 要求草稿可删除 |
| `POST` | `/api/me/questions/{id}/answers` | PRD |
| `PATCH` | `/api/me/answers/{id}` | PRD |
| `POST` | `/api/me/answers/{id}/publish` | 请求体 `{ visibility, draft_revision }`。私密确认写入查看快照，不是送达。公开还要能力和提问者授权 |
| `GET` | `/api/boxes/{slug}/answers` | 只在能力接口允许、且提问者同意过的已发布回复 |

后端已经按这张表实现。和字面规格不同的地方写在根 README 的待确认事项里：

1. 错误响应体是 `{ message, fields }`，`fields` 显示在对应输入框下。
2. 暂停中的箱子仍返回公开资料，并用 `accepting: false` 让页面显示暂停提示。不存在和保留 slug 才返回同样的 404。
3. 回复 JSON 包含 `delivery_state`、`confirmed_content`、`confirmed_at`、`seen_at` 和 `draft_revision`。`sent_at` 是确认时间，不是送达时间。

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
- 触摸设备上可点区域不小于 44px，悬停样式只在支持悬停的设备上生效。

## 导航与多端适配

导航按“主要用手指还是用鼠标操作”区分，而不只看屏幕宽度。规则集中在 `src/lib/hooks.ts` 的 `LAYOUT_MEDIA`，与 `AppShell.module.css` 保持一致。

| 形态 | 条件 | 导航 |
| --- | --- | --- |
| 桌面 | 宽度 ≥ 1024，且主指针不是手指 | 左侧边栏，内容区为内嵌面板 |
| 手机 | 触屏（或窄窗口），宽度 < 600 | 全宽底部标签栏，图标在上、文字在下 |
| 紧凑 | 触屏，高度 ≤ 480（手机横屏、iPhone Duo 外屏横屏） | 48px 高的底部标签栏，图标和文字横排 |
| 悬浮 | 触屏，宽度 ≥ 600 且高度 > 480（平板、折叠屏内屏） | 居中悬浮的胶囊标签栏 |

页面分两级，层级写在路由的 `handle` 里（`src/app/routeMeta.ts`）：

- 一级页面：概览、收件箱、分享、设置。触屏布局显示顶栏和底部标签栏，页面滚过大标题后顶栏换成页面名。切换标签时只做淡入淡出。
- 二级页面：问题详情、设置分区。触屏布局隐藏标签栏，顶部显示“‹ 上一级”返回栏；进入时从右侧推入，返回时反向退出。设置分区在宽屏上和分区列表并排显示，此时按一级页面处理。
- 全屏流程：登录、注册、首次设置、公开提问页，不显示应用导航。

内容布局：

- 收件箱在宽度 ≥ 720 且高度 > 480 时左右分栏，≥ 1280 时三栏（加分类栏），≥ 1600 时放宽列表。
- 宽而矮的屏幕（宽度 ≥ 840、高度 ≤ 640，例如横屏手机、iPhone Duo 内屏横屏）上，公开提问页改为左侧箱主信息和公开回答、右侧固定提问框；开屏页从宽度 840 起左右排列。
- 折叠屏书本姿态和双屏设备（`horizontal-viewport-segments: 2`）：收件箱列表和详情、公开页的两栏、开屏页的文案和示意分别落在折痕两侧，标签栏只占左半屏。笔记本姿态（`vertical-viewport-segments: 2`）下，公开页的提问框放在下半屏。Chrome 138+、三星浏览器已支持；Safari 27.1 需要在实验功能里开启。
- 顶栏、标签栏和页面边距都使用 `env(safe-area-inset-*)`，横屏时不会被刘海或灵动岛遮挡。顶栏和底栏的实际高度通过 `--chrome-top`、`--chrome-bottom` 暴露给页面、Toast 和保存栏。

`e2e/devices.ts` 列出了经过验证的 26 种设备和姿态，包括 Galaxy Fold 外屏（280px）、iPhone SE、iPhone Duo 的外屏、内屏、横竖屏和分屏窗口、Pixel Fold、iPad mini 到 iPad Pro 13、笔记本以及 2560px 显示器，外加一个 Surface Duo 式双屏用例。每个用例检查所有主要页面没有横向溢出、导航形态正确、收件箱是否分栏，以及二级页面会隐藏标签栏。

## 动效

参数在 `src/lib/motion.ts`，与 CSS 令牌同步。

| 用途 | 时长 / 曲线 |
| --- | --- |
| 按下、悬停 | 100–160ms，`ease-out` |
| 页面进入（桌面） | 220ms 淡入并上移 6px；离开 100ms 淡出 |
| 推入 / 返回（触屏） | 260ms 从右侧滑入 28px；返回时方向相反 |
| 切换标签（触屏） | 160ms 淡入淡出 |
| 弹出层、菜单 | 160ms，从触发点缩放 0.97 → 1 |
| 指示器、开关 | 弹簧（stiffness 520 / damping 42），无可见回弹 |
| 弹窗 | 桌面居中缩放；小于 640px 改为底部抽屉 |
| AI 草稿 | 起草中显示呼吸点和骨架；结果逐字显现（读屏软件立即读到全文）；采用后回复框高亮一次 |

所有动画都尊重 `prefers-reduced-motion`：`MotionConfig reducedMotion="user"` 关闭位移，全局 CSS 把过渡缩短到 1ms，逐字显现和开屏演示直接显示最终状态。

## 待产品确认与已知限制

- **Logo**：仓库里还没有 Logo 文件，按仓库规则不绘制替代品。开屏页底部目前以文字显示产品名。拿到原始文件后放到 `public/brand/`，并设置 `src/components/brand/Brand.tsx` 里的 `BRAND_LOGO_SRC`。Favicon 同样暂缺。
- **品牌色**：`--accent` 是在没有 Logo 的情况下选定的临时强调色，拿到 Logo 后只需修改 `tokens.css`。
- **公开回答**：由 `GET /api/capabilities` 的 `public_replies_enabled` 决定。默认关闭。
- **私密回复的送达方式**：提问者如何看到私密回复仍待确认，前端只记录“已私密回复”，不承诺通知提问者。
- **认证方式**：登录注册界面先按邮箱加密码实现，接口集中在 `ApiClient`，更换认证方式不影响页面结构。
- **深色模式、多语言**：未实现，令牌结构已为深色模式预留。
