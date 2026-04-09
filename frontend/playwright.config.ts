import { chromium, defineConfig } from "@playwright/test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(frontendDir, "..");
const browserWrapperPath = path.join(frontendDir, "scripts", "playwright-browser.sh");
const chromiumPath = chromium.executablePath();
const chromiumInstallDir = path.dirname(path.dirname(chromiumPath));
const chromiumVersionSuffix = path.basename(chromiumInstallDir).replace(/^chromium-/, "");
const headlessShellPathCandidate = path.join(
  path.dirname(chromiumInstallDir),
  `chromium_headless_shell-${chromiumVersionSuffix}`,
  "chrome-headless-shell-linux64",
  "chrome-headless-shell",
);
const realChromiumPath = fs.existsSync(headlessShellPathCandidate) ? headlessShellPathCandidate : chromiumPath;
const nodeBinCandidates = [
  process.env.DOPAFLOW_PLAYWRIGHT_NODE_BIN,
  path.resolve(repoRoot, "..", "..", ".codex-bin"),
  path.resolve(repoRoot, "..", "..", ".codex-tools", "node-v20.20.2-linux-x64", "bin"),
].filter((value): value is string => Boolean(value));
const nodeBinPath = nodeBinCandidates.filter((candidate) => fs.existsSync(candidate)).join(path.delimiter);
const existingPath = process.env.PATH ?? "";
const bundledRuntimeLibCandidates = [
  process.env.DOPAFLOW_PLAYWRIGHT_LD_LIBRARY_PATH,
  path.join(repoRoot, "desktop", "vendor-runtime", "extract", "usr", "lib", "x86_64-linux-gnu"),
  path.join(repoRoot, "desktop", "dist", "linux-unpacked", "usr", "lib"),
].filter((value): value is string => Boolean(value));
const bundledRuntimeLibs = bundledRuntimeLibCandidates.find((candidate) => fs.existsSync(candidate));
const existingLdLibraryPath = process.env.LD_LIBRARY_PATH;
const npmCommand = process.env.DOPAFLOW_PLAYWRIGHT_WEB_SERVER_COMMAND ?? "npm run dev -- --host 127.0.0.1 --port 4173";
const resolvedPath = nodeBinPath ? `${nodeBinPath}${path.delimiter}${existingPath}` : existingPath;

if (bundledRuntimeLibs) {
  process.env.LD_LIBRARY_PATH = existingLdLibraryPath
    ? `${bundledRuntimeLibs}:${existingLdLibraryPath}`
    : bundledRuntimeLibs;
}

if (resolvedPath) {
  process.env.PATH = resolvedPath;
}

process.env.DOPAFLOW_PLAYWRIGHT_REAL_CHROMIUM = realChromiumPath;
if (bundledRuntimeLibs) {
  process.env.DOPAFLOW_PLAYWRIGHT_LD_LIBRARY_PATH = bundledRuntimeLibs;
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: {
      executablePath: fs.existsSync(browserWrapperPath) ? browserWrapperPath : realChromiumPath,
      env: {
        ...process.env,
        ...(resolvedPath ? { PATH: resolvedPath } : {}),
        ...(process.env.LD_LIBRARY_PATH ? { LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH } : {}),
      },
    },
  },
  webServer: {
    command: `bash -lc '${npmCommand}'`,
    cwd: frontendDir,
    env: {
      ...process.env,
      ...(resolvedPath ? { PATH: resolvedPath } : {}),
      ...(process.env.LD_LIBRARY_PATH ? { LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH } : {}),
    },
    url: "http://127.0.0.1:4173",
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
