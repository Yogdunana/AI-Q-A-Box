import { expect, test, type Page } from "@playwright/test";
import { DEVICES } from "./devices";

async function signInWithDemo(page: Page) {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "使用演示账号体验" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

const PAGES = [
  "/",
  "/lin",
  "/reply",
  "/auth/login",
  "/app",
  "/app/inbox",
  "/app/questions/q_demo_5",
  "/app/share",
  "/app/settings",
  "/app/settings/style",
];

for (const device of DEVICES) {
  test.describe(device.name, () => {
    test.use({ viewport: { width: device.width, height: device.height }, hasTouch: device.touch, isMobile: device.touch });

    test(`${device.width}×${device.height}: ${device.nav} navigation${device.split ? ", split inbox" : ""}`, async ({ page }) => {
      await signInWithDemo(page);

      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await horizontalOverflow(page), `${path} overflows`).toBeLessThanOrEqual(0);
      }

      await page.goto("/app/inbox");
      await page.locator("[data-id]").first().waitFor();

      const tabbar = page.getByTestId("nav-tabbar");
      const sidebar = page.getByTestId("nav-sidebar");
      if (device.nav === "sidebar") {
        await expect(sidebar).toBeVisible();
        await expect(tabbar).toBeHidden();
      } else {
        await expect(tabbar).toBeVisible();
        await expect(sidebar).toBeHidden();
        const box = (await tabbar.boundingBox())!;
        if (device.nav === "floating") expect(box.width).toBeLessThan(device.width - 40);
        else expect(Math.round(box.width)).toBe(device.width);
        if (device.nav === "compact") expect(box.height).toBeLessThanOrEqual(52);
      }

      const detail = page.getByRole("region", { name: "问题详情" });
      if (device.split) await expect(detail).toBeVisible();
      else await expect(detail).toHaveCount(0);

      if (device.nav !== "sidebar") {
        // Level-2 page: the tab bar gives way to a back bar.
        await page.goto("/app/questions/q_demo_5");
        await expect(page.getByRole("button", { name: "返回收件箱" })).toBeVisible();
        await expect(tabbar).toHaveCount(0);
      }
    });
  });
}

test.describe("dual-screen and book posture", () => {
  test.use({ viewport: { width: 1114, height: 720 }, hasTouch: true, isMobile: true });

  test("splits list and detail across the fold", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "display feature emulation is Chromium-only");
    await signInWithDemo(page);
    await page.goto("/app/inbox");
    await page.locator("[data-id]").first().waitFor();
    // Surface Duo–style hinge: two 540px screens with a 34px gap. Applied after
    // navigation because Playwright re-applies its own metrics on each goto.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1114,
      height: 720,
      deviceScaleFactor: 1,
      mobile: true,
      displayFeature: { orientation: "vertical", offset: 540, maskLength: 34 },
    });

    const segmented = await page.evaluate(() => matchMedia("(horizontal-viewport-segments: 2)").matches);
    test.skip(!segmented, "this browser build does not expose viewport segments");

    const list = (await page.getByRole("region", { name: "问题列表" }).boundingBox())!;
    const detail = (await page.getByRole("region", { name: "问题详情" }).boundingBox())!;
    expect(list.x + list.width).toBeLessThanOrEqual(541);
    expect(detail.x).toBeGreaterThanOrEqual(573);

    const tabbar = (await page.getByTestId("nav-tabbar").boundingBox())!;
    expect(tabbar.x + tabbar.width).toBeLessThanOrEqual(541);
  });
});
