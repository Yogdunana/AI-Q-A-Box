import { defineConfig, devices } from "@playwright/test";

const PORT = 4174;
/** Set PW_CHANNEL=chrome to use an installed Chrome instead of Playwright's bundled Chromium. */
const channel = process.env.PW_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "live-reply.spec.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    channel,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, testIgnore: /devices\.spec\.ts/ },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
