import { defineConfig, devices } from "@playwright/test";

const port = 4175;
const channel = process.env.PW_CHANNEL;

/**
 * Real API plus an isolated sqlite file. The model upstream is the local stub,
 * not a mock of the business API.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "live-reply.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    channel,
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: "node ../server/scripts/ai-stub.mjs",
      url: "http://127.0.0.1:8799/health",
      reuseExistingServer: false,
    },
    {
      command:
        "rm -f /tmp/askme-live-e2e.sqlite /tmp/askme-live-e2e.sqlite-shm /tmp/askme-live-e2e.sqlite-wal && node --experimental-sqlite --experimental-strip-types --disable-warning=ExperimentalWarning src/index.ts",
      cwd: "../server",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: false,
      env: {
        NODE_ENV: "development",
        HOST: "127.0.0.1",
        PORT: "8787",
        DATABASE_PATH: "/tmp/askme-live-e2e.sqlite",
        SESSION_SECRET: "e2e-session-secret-value-32chars-min",
        IP_HASH_PEPPER: "e2e-ip-pepper-value-32-characters",
        COOKIE_SECURE: "false",
        WEB_ORIGINS: "http://127.0.0.1:4175",
        TRUST_PROXY: "false",
        PUBLIC_REPLIES_ENABLED: "false",
        AI_PROVIDER: "openai",
        AI_BASE_URL: "http://127.0.0.1:8799/v1",
        AI_API_KEY: "e2e-not-a-real-key",
        AI_MODEL: "e2e-stub",
        AI_TIMEOUT_MS: "8000",
      },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      env: {
        VITE_APP_INTENT: "development",
        VITE_API_MODE: "http",
        VITE_API_BASE_URL: "",
      },
    },
  ],
});
