import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const bundledRuntimeLibCandidates = [
  process.env.DOPAFLOW_PLAYWRIGHT_LD_LIBRARY_PATH,
  "/home/henry/vscode/build/dopaflow/desktop/dist/linux-unpacked/usr/lib",
  "/home/henry/release/DopaFlow-2.0.7-linux-unpacked/usr/lib",
].filter((value): value is string => Boolean(value));
const bundledRuntimeLibs = bundledRuntimeLibCandidates.find((candidate) => fs.existsSync(candidate));
const existingLdLibraryPath = process.env.LD_LIBRARY_PATH;

if (bundledRuntimeLibs) {
  process.env.LD_LIBRARY_PATH = existingLdLibraryPath
    ? `${bundledRuntimeLibs}:${existingLdLibraryPath}`
    : bundledRuntimeLibs;
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "bash -lc 'PATH=/home/henry/vscode/.codex-bin:$PATH /home/henry/vscode/.codex-bin/npm run dev -- --host 127.0.0.1 --port 4173'",
    cwd: frontendDir,
    url: "http://127.0.0.1:4173",
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
