const test = require("node:test");
const assert = require("node:assert/strict");

const { BackendRuntime } = require("../backend-runtime");

test("waitForHealth retries until the readiness endpoint returns 200", async () => {
  const calls = [];
  const runtime = new BackendRuntime({ healthUrl: "http://127.0.0.1:8000/health/ready" });
  const response = { resume() {} };
  const http = require("node:http");
  const originalHttpGet = http.get;
  const originalSetTimeout = global.setTimeout;
  let attempts = 0;

  http.get = (url, callback) => {
    calls.push(url);
    attempts += 1;
    response.statusCode = attempts === 1 ? 503 : 200;
    callback(response);
    return { on() {} };
  };
  global.setTimeout = (fn) => {
    fn();
    return 0;
  };

  try {
    await runtime.waitForHealth(1000);
  } finally {
    http.get = originalHttpGet;
    global.setTimeout = originalSetTimeout;
  }

  assert.deepEqual(calls, [
    "http://127.0.0.1:8000/health/ready",
    "http://127.0.0.1:8000/health/ready",
  ]);
});
