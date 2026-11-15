import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { resolveAppIntent } from "./src/config/runtime-intent.js";

export default defineConfig(({ command, mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const resolved = resolveAppIntent({
    command: command === "build" ? "build" : "serve",
    mode,
    env: { ...fileEnv, ...process.env },
  });
  return {
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_INTENT": JSON.stringify(resolved.intent),
    "import.meta.env.VITE_API_MODE": JSON.stringify(resolved.apiMode),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
    include: ["src/**/*.test.{ts,tsx}"],
  },
  };
});
