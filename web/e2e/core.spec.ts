import { expect, test, type Page } from "@playwright/test";

async function signInWithDemo(page: Page) {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "使用演示账号体验" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe("core flow", () => {
  test("a visitor's question reaches the owner's inbox", async ({ page }) => {
    const question = `端到端测试的问题 ${Date.now()}`;

    await page.goto("/lin");
    await page.getByLabel("你的问题").fill(question);
    await page.getByRole("button", { name: /发送问题/ }).click();
    await expect(page.getByRole("heading", { name: "问题已送达" })).toBeVisible();
    await expect(page.getByText(question)).toBeVisible();

    await signInWithDemo(page);
    await page.goto("/app/inbox?view=new");
    await expect(page.locator("[data-id]").first()).toContainText(question);
  });

  test("the landing page keeps its required brand block and avoids the banned copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "创建我的提问箱" })).toBeVisible();
    const footer = page.locator("footer");
    await expect(footer.getByText("Ask “Me”")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/AI\s*帮箱主回复|AI\s*代回复|让\s*AI\s*替你回答/);
  });
});

test.describe("owner navigation", () => {
  test("opens a question from the inbox and drafts a reply", async ({ page, isMobile }) => {
    await signInWithDemo(page);
    if (isMobile) await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "收件箱" }).click();
    else await page.getByRole("link", { name: "收件箱" }).first().click();
    await expect(page).toHaveURL(/\/app\/inbox/);

    await page.locator("[data-id]").first().click();
    if (isMobile) await expect(page).toHaveURL(/\/app\/questions\//);

    await page.getByRole("button", { name: "生成回复草稿" }).click();
    await expect(page.getByText("正在起草…")).toBeVisible();
    await expect(page.getByRole("button", { name: "采用并编辑" })).toBeEnabled({ timeout: 8000 });
  });
});

const WIDTHS = [320, 375, 768, 1024, 1440];
const PAGES = ["/", "/lin", "/auth/login", "/app", "/app/inbox", "/app/share", "/app/settings"];

test.describe("responsive layout", () => {
  test.skip(({ isMobile }) => isMobile, "widths are set explicitly");

  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signInWithDemo(page);
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});
