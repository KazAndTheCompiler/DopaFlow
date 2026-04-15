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
    this.healthTimeoutMs = options.healthTimeoutMs ?? 10000;
    this.restartTimer = null;
    this.startGeneration = 0;
    this.shouldRestart = true;
  }

  waitForHealth(timeoutMs = this.healthTimeoutMs ?? 10000) {
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
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.child) {
      return this.child;
    }

    this.shouldRestart = true;
    const generation = ++this.startGeneration;
    const child = spawn(this.command, this.args, {
      cwd: this.cwd,
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, ...(this.env ?? {}) },
    });
    this.child = child;

    child.on("spawn", () => {
      this.waitForHealth()
        .then(() => {
          if (this.child === child && this.shouldRestart && this.startGeneration === generation) {
            this.emit("ready");
          }
        })
        .catch((error) => {
          if (this.child === child && this.startGeneration === generation) {
            this.emit("crash", error);
          }
        });
    });

    child.on("exit", (code) => {
      if (this.child === child) {
        this.child = null;
      }
      if (!this.shouldRestart || this.startGeneration !== generation) {
        return;
      }
      this.emit("crash", code);
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (this.shouldRestart && !this.child && this.startGeneration === generation) {
          this.start();
        }
      }, this.restartDelayMs);
    });

    return child;
  }

  stop() {
    /** Terminate the backend process if one is active. */
    this.shouldRestart = false;
    this.startGeneration += 1;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}

module.exports = { BackendRuntime };
