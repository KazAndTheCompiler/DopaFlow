const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { WindowRuntime, isTrustedNavigationUrl, normalizeDeepLink, normalizeRoutePath } = require("../window-runtime");

function createBrowserWindowHarness() {
  const windows = [];

  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.bounds = {
        x: options.x ?? 0,
        y: options.y ?? 0,
        width: options.width,
        height: options.height,
      };
      this.destroyed = false;
      this.maximized = false;
      this.shown = false;
      this.devToolsOpened = false;
      this.windowOpenHandler = null;
      this.navigationHandler = null;
      this.webContents = {
        setWindowOpenHandler: (handler) => {
          this.windowOpenHandler = handler;
        },
        on: (event, handler) => {
          if (event === "will-navigate") {
            this.navigationHandler = handler;
          }
        },
        once() {},
        send() {},
        openDevTools: () => {
          this.devToolsOpened = true;
        },
      };
      windows.push(this);
    }

    loadURL(url) {
      this.lastUrl = url;
    }

    loadFile(filePath, options) {
      this.lastFile = { filePath, options };
    }

    show() {
      this.shown = true;
    }

    focus() {}

    maximize() {
      this.maximized = true;
    }

    isMaximized() {
      return this.maximized;
    }

    isDestroyed() {
      return this.destroyed;
    }

    getBounds() {
      return { ...this.bounds };
    }

    getNormalBounds() {
      return { ...this.bounds };
    }
  }

  return { BrowserWindow, windows };
}

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

test("createWindow restores stored bounds when they fit a current display", () => {
  const configStore = {
    get(key) {
      assert.equal(key, "windowBounds");
      return {
        x: 200,
        y: 100,
        width: 1280,
        height: 720,
        isMaximised: true,
      };
    },
  };
  const { BrowserWindow, windows } = createBrowserWindowHarness();
  const runtime = new WindowRuntime({
    BrowserWindow,
    screen: {
      getAllDisplays: () => [
        {
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        },
      ],
    },
    configStore,
    isPackaged: true,
    assetsDir: "/tmp/assets",
    preloadPath: "/tmp/preload.js",
    frontendDistPath: "/tmp/index.html",
  });

  runtime.createWindow("#/today", "main");

  assert.equal(windows[0].options.x, 200);
  assert.equal(windows[0].options.y, 100);
  assert.equal(windows[0].options.width, 1280);
  assert.equal(windows[0].options.height, 720);
  windows[0].emit("ready-to-show");
  assert.equal(windows[0].maximized, true);
});

test("createWindow ignores stored bounds outside current displays", () => {
  const { BrowserWindow, windows } = createBrowserWindowHarness();
  const runtime = new WindowRuntime({
    BrowserWindow,
    screen: {
      getAllDisplays: () => [
        {
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        },
      ],
    },
    configStore: {
      get() {
        return {
          x: 4000,
          y: 3000,
          width: 1280,
          height: 720,
          isMaximised: false,
        };
      },
    },
    isPackaged: true,
    assetsDir: "/tmp/assets",
    preloadPath: "/tmp/preload.js",
    frontendDistPath: "/tmp/index.html",
  });

  runtime.createWindow("#/today", "main");

  assert.equal(windows[0].options.x, undefined);
  assert.equal(windows[0].options.y, undefined);
  assert.equal(windows[0].options.width, 1440);
  assert.equal(windows[0].options.height, 880);
});

test("createWindow persists the main window bounds on close", () => {
  const saved = [];
  const { BrowserWindow, windows } = createBrowserWindowHarness();
  const runtime = new WindowRuntime({
    BrowserWindow,
    screen: {
      getAllDisplays: () => [],
    },
    configStore: {
      get() {
        return undefined;
      },
      set(key, value) {
        saved.push([key, value]);
      },
    },
    isPackaged: true,
    assetsDir: "/tmp/assets",
    preloadPath: "/tmp/preload.js",
    frontendDistPath: "/tmp/index.html",
  });

  runtime.createWindow("#/today", "main");
  windows[0].bounds = { x: 120, y: 80, width: 1500, height: 900 };
  windows[0].maximized = true;
  windows[0].emit("close");

  assert.deepEqual(saved, [[
    "windowBounds",
    {
      x: 120,
      y: 80,
      width: 1500,
      height: 900,
      isMaximised: true,
    },
  ]]);
});
