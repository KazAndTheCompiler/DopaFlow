const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const http = require("node:http");

class BackendRuntime extends EventEmitter {
  /** Manage the Python backend process and emit lifecycle events for Electron. */
  constructor(options = {}) {
    super();
    this.command = options.command ?? "python3";
    this.args = options.args ?? ["-m", "app.main"];
    this.cwd = options.cwd;
    this.child = null;
    this.env = options.env ?? null;
    this.restartDelayMs = options.restartDelayMs ?? 2000;
    this.healthUrl = options.healthUrl ?? "http://127.0.0.1:8000/health";
  }

  waitForHealth(timeoutMs = 10000) {
    /** Poll the backend health endpoint until it responds or the timeout elapses. */
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const poll = () => {
        const request = http.get(this.healthUrl, (response) => {
          response.resume();
          if (response.statusCode === 200) {
            resolve();
            return;
          }

          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error("Timed out waiting for backend health."));
            return;
          }

          setTimeout(poll, 250);
        });

        request.on("error", () => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error("Timed out waiting for backend health."));
            return;
          }

          setTimeout(poll, 250);
        });
      };

      poll();
    });
  }

  start() {
    /** Spawn the backend process and emit a ready signal after a health probe delay. */
    this.child = spawn(this.command, this.args, {
      cwd: this.cwd,
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, ...(this.env ?? {}) },
    });

    this.child.on("spawn", () => {
      this.waitForHealth()
        .then(() => this.emit("ready"))
        .catch((error) => this.emit("crash", error));
    });

    this.child.on("exit", (code) => {
      this.emit("crash", code);
      setTimeout(() => this.start(), this.restartDelayMs);
    });

    return this.child;
  }

  stop() {
    /** Terminate the backend process if one is active. */
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}

module.exports = { BackendRuntime };
