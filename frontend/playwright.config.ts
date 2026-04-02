import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "bash -lc 'PATH=/tmp/node-install/node-v20.20.2-linux-x64/bin:$PATH npm run dev -- --host 127.0.0.1 --port 4173'",
    cwd: frontendDir,
    url: "http://127.0.0.1:4173",
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
