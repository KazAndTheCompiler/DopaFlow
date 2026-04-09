const test = require("node:test");
const assert = require("node:assert/strict");

const { WindowRuntime, isTrustedNavigationUrl, normalizeDeepLink, normalizeRoutePath } = require("../window-runtime");

test("normalizeRoutePath falls back for invalid or unsafe values", () => {
  assert.equal(normalizeRoutePath(undefined), "#/today");
  assert.equal(normalizeRoutePath("javascript:alert(1)"), "#/today");
  assert.equal(normalizeRoutePath("#/tasks"), "#/tasks");
  assert.equal(normalizeRoutePath("/calendar"), "#/calendar");
});

test("normalizeDeepLink resolves valid dopaflow links and rejects others", () => {
  assert.equal(normalizeDeepLink("dopaflow://calendar"), "#/calendar");
  assert.equal(normalizeDeepLink("dopaflow://review/deck-alpha"), "#/review/deck-alpha");
  assert.equal(normalizeDeepLink("https://example.com/calendar"), null);
  assert.equal(normalizeDeepLink("dopaflow://../etc/passwd"), null);
});

test("openPath sanitizes the route before loading it", () => {
  const loaded = [];
  const runtime = new WindowRuntime({
    BrowserWindow: function BrowserWindow() {},
    isPackaged: false,
    assetsDir: "/tmp/assets",
    preloadPath: "/tmp/preload.js",
    frontendDistPath: "/tmp/index.html",
    devServerOrigin: "http://127.0.0.1:5173",
  });

  runtime.focusMainWindow = () => ({
    loadURL(url) {
      loaded.push(url);
    },
  });

  runtime.openPath("javascript:alert(1)");
  runtime.openPath("#/journal");

  assert.deepEqual(loaded, [
    "http://127.0.0.1:5173/#/today",
    "http://127.0.0.1:5173/#/journal",
  ]);
});

test("isTrustedNavigationUrl only allows app-owned URLs", () => {
  assert.equal(isTrustedNavigationUrl("http://127.0.0.1:5173/#/today", {
    isPackaged: false,
    devServerOrigin: "http://127.0.0.1:5173",
  }), true);
  assert.equal(isTrustedNavigationUrl("https://example.com", {
    isPackaged: false,
    devServerOrigin: "http://127.0.0.1:5173",
  }), false);
  assert.equal(isTrustedNavigationUrl("file:///tmp/index.html#/today", {
    isPackaged: true,
    frontendDistPath: "/tmp/index.html",
  }), true);
});
