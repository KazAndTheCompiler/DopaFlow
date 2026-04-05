const { spawnSync } = require("node:child_process");
const path = require("node:path");

const [, , channelArg, ...builderArgs] = process.argv;
const channel = channelArg === "stable" ? "stable" : "dev";
const isStable = channel === "stable";

const env = {
  ...process.env,
  DOPAFLOW_RELEASE_CHANNEL: channel,
  DOPAFLOW_GITHUB_OWNER: process.env.DOPAFLOW_GITHUB_OWNER || "KazAndTheCompiler",
  DOPAFLOW_GITHUB_REPO: process.env.DOPAFLOW_GITHUB_REPO || "dopaflow",
};

if (!isStable) {
  env.GH_TOKEN = "";
}

const isWindows = process.platform === "win32";
const electronBuilderBin = path.join(__dirname, "..", "node_modules", ".bin", isWindows ? "electron-builder.cmd" : "electron-builder");
const result = isWindows
  ? spawnSync("npx", ["electron-builder", ...builderArgs], {
      cwd: path.join(__dirname, ".."),
      env,
      stdio: "inherit",
      shell: true,
    })
  : spawnSync(electronBuilderBin, builderArgs, {
      cwd: path.join(__dirname, ".."),
      env,
      stdio: "inherit",
    });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
