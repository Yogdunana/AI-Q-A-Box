import { expect, test, type Page } from "@playwright/test";

test("owner and asker complete a private reply across two browsers", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const askerContext = await browser.newContext();
  const strangerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const asker = await askerContext.newPage();
  const stranger = await strangerContext.newPage();
  const email = `owner-${Date.now()}@example.com`;

  await registerOwner(owner, email, "livebox");
  await expect(owner.getByText("演示模式")).toHaveCount(0);

  const question = `跨浏览器的问题 ${Date.now()}`;
  await asker.goto("/livebox");
  await asker.getByLabel("你的问题").fill(question);
  await expect(asker.getByText("无法补发")).toBeVisible();
  await expect(asker.getByRole("switch", { name: "允许公开" })).toHaveCount(0);
  await asker.getByRole("button", { name: /发送问题/ }).click();
  await expect(asker.getByRole("heading", { name: "问题已提交" })).toBeVisible();
  const link = await asker.getByLabel("查看链接").inputValue();
  expect(link).toContain("/reply#");

  await asker.goto(link);
  await expect(asker).toHaveURL(/\/reply$/);
  await expect(asker.getByRole("heading", { name: "回复还没有确认" })).toBeVisible();
  await expect(asker.getByText(question)).toBeVisible();

  await owner.goto("/app/inbox");
  await owner.locator("[data-id]").filter({ hasText: question }).click();
  await owner.getByRole("button", { name: "生成回复草稿" }).click();
  await expect(owner.getByRole("button", { name: "采用并编辑" })).toBeEnabled({ timeout: 15_000 });
  await owner.getByRole("button", { name: "采用并编辑" }).click();
  const editor = owner.getByLabel("回复内容");
  await editor.fill("这是确认后提问者才能看到的话。");
  await expect(owner.getByText("已保存")).toBeVisible();
  await expect(owner.getByRole("button", { name: "公开" })).toHaveCount(0);
  await owner.getByRole("button", { name: "确认回复" }).click();
  await owner.getByRole("dialog", { name: "确认这条回复？" }).getByRole("button", { name: "确认回复" }).click();
  await expect(owner.getByText("回复已确认，提问者可以用查看链接看到")).toBeVisible();

  await asker.reload();
  await expect(asker.getByText("这是确认后提问者才能看到的话。")).toBeVisible();

  await owner.getByRole("button", { name: "编辑回复" }).click();
  await owner.getByLabel("回复内容").fill("这句还没有再次确认。");
  await expect(owner.getByText("已保存")).toBeVisible();
  await asker.reload();
  await expect(asker.getByText("这是确认后提问者才能看到的话。")).toBeVisible();
  await expect(asker.getByText("这句还没有再次确认。")).toHaveCount(0);

  await stranger.goto("/reply#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(stranger.getByRole("heading", { name: "链接无效" })).toBeVisible();
  const selected = new URL(owner.url()).searchParams.get("selected");
  expect(selected).toBeTruthy();
  expect((await strangerContext.request.get(`/api/me/questions/${selected}`)).status()).toBe(401);

  const other = await strangerContext.newPage();
  await registerOwner(other, `other-${Date.now()}@example.com`, "otherbox");
  await other.goto("/app/inbox");
  await expect(other.getByText(question)).toHaveCount(0);
  expect((await strangerContext.request.get(`/api/me/questions/${selected}`)).status()).toBe(404);

  await owner.getByRole("button", { name: "更多操作" }).click();
  await owner.getByRole("menuitem", { name: "删除问题" }).click();
  await owner.getByRole("button", { name: "删除" }).click();
  await asker.reload();
  await expect(asker.getByRole("heading", { name: "问题已删除" })).toBeVisible();

  await ownerContext.close();
  await askerContext.close();
  await strangerContext.close();
});

test("switching questions in the inbox keeps unsaved text", async ({ page }) => {
  const email = `draft-${Date.now()}@example.com`;
  await registerOwner(page, email, "draftbox");
  const first = `先写一半 ${Date.now()}`;
  const second = `另一个问题 ${Date.now()}`;
  await submitWhileSignedIn(page, "draftbox", first);
  await submitWhileSignedIn(page, "draftbox", second);
  await page.goto("/app/inbox");
  await expect(page.locator("[data-id]").filter({ hasText: second })).toBeVisible();
  const editor = page.getByLabel("回复内容");
  await editor.fill("这段还没保存完");
  await page.locator("[data-id]").filter({ hasText: first }).click();
  const dialog = page.getByRole("dialog", { name: "回复还没保存" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(editor).toHaveValue("这段还没保存完");
});

test("deleting during generation does not restore the question", async ({ page }) => {
  await registerOwner(page, `slow-${Date.now()}@example.com`, "slowbox");
  const question = `SLOW_DRAFT ${Date.now()}`;
  await submitWhileSignedIn(page, "slowbox", question);
  await page.goto("/app/inbox");
  await page.locator("[data-id]").filter({ hasText: question }).click();
  await page.getByRole("button", { name: "生成回复草稿" }).click();
  await expect(page.getByText("正在起草…")).toBeVisible();
  await page.getByRole("button", { name: "更多操作" }).click();
  await page.getByRole("menuitem", { name: "删除问题" }).click();
  await page.getByRole("button", { name: "删除" }).click();
  await expect(page.getByText(question)).toHaveCount(0);
  await page.waitForTimeout(2000);
  await page.reload();
  await expect(page.getByText(question)).toHaveCount(0);
});

async function registerOwner(page: Page, email: string, slug: string) {
  await page.goto("/auth/register");
  await page.getByLabel("你的名字").fill("箱主");
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("textbox", { name: "密码" }).fill("password-secret-1");
  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByRole("heading", { name: "设置你的提问箱" })).toBeVisible();
  await page.getByLabel("链接地址").fill(slug);
  await expect(page.getByLabel("可以使用")).toBeVisible();
  await page.getByRole("button", { name: "创建提问箱" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function submitWhileSignedIn(page: Page, slug: string, content: string) {
  await page.goto(`/${slug}`);
  await page.getByLabel("你的问题").fill(content);
  await page.getByRole("button", { name: /发送问题/ }).click();
  await expect(page.getByRole("heading", { name: "问题已提交" })).toBeVisible();
}
