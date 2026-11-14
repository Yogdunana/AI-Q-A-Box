import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fromRoot = (path) => join(root, path);

const routes = [
  "web/src/app/page.tsx",
  "web/src/app/[slug]/page.tsx",
  "web/src/app/[slug]/submitted/page.tsx",
  "web/src/app/auth/login/page.tsx",
  "web/src/app/auth/register/page.tsx",
  "web/src/app/app/page.tsx",
  "web/src/app/app/inbox/page.tsx",
  "web/src/app/app/questions/[id]/page.tsx",
  "web/src/app/app/settings/page.tsx",
  "web/src/app/app/share/page.tsx",
  "web/src/app/legal/privacy/page.tsx",
  "web/src/app/legal/terms/page.tsx",
  "web/src/app/legal/deletion/page.tsx",
  "web/src/app/report/page.tsx",
];

const forbidden = ["AI帮箱主回复", "AI 代回复", "让 AI 替你回答"];

test("页面路由文件都在", () => {
  const missing = routes.filter((route) => !existsSync(fromRoot(route)));
  assert.deepEqual(missing, []);
});

test("开屏页预留 Logo 且没有禁止文案", () => {
  const source = [
    readFileSync(fromRoot("web/src/app/page.tsx"), "utf8"),
    readFileSync(fromRoot("web/src/components/page-shell.tsx"), "utf8"),
  ].join("\n");
  assert.match(source, /Logo 尚未提供/);
  assert.match(source, /创建我的提问箱/);
  assert.match(source, /登录/);
  for (const phrase of forbidden) {
    assert.equal(source.includes(phrase), false, phrase);
  }
});

test("环境示例不包含密钥值", () => {
  const example = readFileSync(fromRoot("web/.env.example"), "utf8");
  assert.match(example, /DATABASE_URL=\s*$/m);
  assert.doesNotMatch(example, /sk-|postgres:\/\/.+:.+@/);
});
