const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Module = require("node:module");
const path = require("node:path");

const mainPath = path.join(__dirname, "..", "main.js");

async function loadMain({ backendChild, platform = "linux", gotLock = true, mainWindow = null } = {}) {
  const originalLoad = Module._load;
  const originalPlatform = process.platform;
  const originalResourcesPath = process.resourcesPath;
  const handlers = {};
  const state = {};

  class MockBackendRuntime extends EventEmitter {
    constructor() {
      super();
      this.child = backendChild ?? null;
      this.stopCalls = 0;
      state.runtime = this;
    }

    start() {
      return this.child;
    }

    stop() {
      this.stopCalls += 1;
      this.child = null;
    }
  }

  class MockNotificationRuntime {
    constructor(options = {}) {
      this.stopCalls = 0;
      this.options = options;
      state.notificationRuntime = this;
    }

    start() {}

    stop() {
      this.stopCalls += 1;
    }
  }

  class MockWindowRuntime {
    constructor() {
      state.windowRuntime = this;
    }

    ensureMainWindow() {
      return {
        webContents: {
          send() {},
        },
      };
    }

    sendToAll() {}
    focusMainWindow() {}
    openJournalWindow() {}
    openCalendar() {}
    openPath(routePath) {
      state.openPathCalls = [...(state.openPathCalls ?? []), routePath];
    }
    openDeepLink() {}
    getMainWindow() {
      return mainWindow;
    }
  }

  const electron = {
    app: {
      isPackaged: false,
      requestSingleInstanceLock: () => gotLock,
      on: (event, handler) => {
        handlers[event] = handler;
      },
      whenReady: () => Promise.resolve(),
      setAsDefaultProtocolClient() {},
      quit() {
        state.quitCalls = (state.quitCalls ?? 0) + 1;
      },
      setBadgeCount() {},
      getVersion: () => "2.0.11",
    },
    BrowserWindow: function BrowserWindow() {},
    Tray: function Tray() {
      return {
        setToolTip() {},
        setTitle() {},
        setContextMenu() {},
      };
    },
    Menu: {
      buildFromTemplate: (template) => template,
    },
    Notification: function Notification() {
      return {
        on() {},
        show() {},
      };
    },
    globalShortcut: {
      register() {},
      unregisterAll() {
        state.shortcutsUnregistered = (state.shortcutsUnregistered ?? 0) + 1;
      },
    },
    ipcMain: {
      handle() {},
      on(channel, handler) {
        state.ipcHandlers = {
          ...(state.ipcHandlers ?? {}),
          [channel]: handler,
        };
      },
    },
    shell: {
      openExternal() {},
    },
  };

  Module._load = function mockLoad(request, parent, isMain) {
    if (request === "electron") {
      return electron;
    }
    if (request === "electron-store") {
      return {
        default: class Store {
          get() {
            return undefined;
          }

          set() {}
        },
      };
    }
    if (request === "electron-updater") {
      return {
        autoUpdater: {
          on() {},
          checkForUpdatesAndNotify: () => Promise.resolve(),
          quitAndInstall() {},
        },
      };
    }
    if (request === "electron-auto-launch") {
      return class AutoLaunch {};
    }
    if (request === "./backend-runtime" && parent?.filename === mainPath) {
      return { BackendRuntime: MockBackendRuntime };
    }
    if (request === "./notification-runtime" && parent?.filename === mainPath) {
      return { NotificationRuntime: MockNotificationRuntime };
    }
    if (request === "./runtime-auth" && parent?.filename === mainPath) {
      return { buildBackendEnv: () => ({}) };
    }
    if (request === "./window-runtime" && parent?.filename === mainPath) {
      return { WindowRuntime: MockWindowRuntime };
    }
    return originalLoad(request, parent, isMain);
  };

  delete require.cache[require.resolve(mainPath)];
  Object.defineProperty(process, "platform", { value: platform });
  process.resourcesPath = path.join(__dirname, "..");

  try {
    require(mainPath);
    await new Promise((resolve) => setImmediate(resolve));
    return { handlers, state };
  } finally {
    Module._load = originalLoad;
    Object.defineProperty(process, "platform", { value: originalPlatform });
    process.resourcesPath = originalResourcesPath;
    delete require.cache[require.resolve(mainPath)];
  }
}

test("will-quit kills the backend child on Linux", async () => {
  let killCalls = 0;
  const backendChild = {
    killed: false,
    exitCode: null,
    signalCode: null,
    kill() {
      killCalls += 1;
      this.killed = true;
    },
  };
  const { handlers, state } = await loadMain({ backendChild, platform: "linux" });

  handlers["will-quit"]();

  assert.equal(killCalls, 1);
  assert.equal(state.runtime.stopCalls, 1);
  assert.equal(state.notificationRuntime.stopCalls, 1);
  assert.equal(state.shortcutsUnregistered, 1);
});

test("will-quit skips kill when the backend child already exited", async () => {
  let killCalls = 0;
  const backendChild = {
    killed: false,
    exitCode: 0,
    signalCode: null,
    kill() {
      killCalls += 1;
    },
  };
  const { handlers, state } = await loadMain({ backendChild, platform: "linux" });

  handlers["will-quit"]();

  assert.equal(killCalls, 0);
  assert.equal(state.runtime.stopCalls, 1);
});

test("quits immediately when the app cannot acquire the single instance lock", async () => {
  const { handlers, state } = await loadMain({ gotLock: false });

  assert.equal(state.quitCalls, 1);
  assert.equal(typeof handlers["second-instance"], "undefined");
});

test("second-instance shows and focuses the existing main window", async () => {
  const calls = [];
  const mainWindow = {
    show() {
      calls.push("show");
    },
    focus() {
      calls.push("focus");
    },
  };
  const { handlers } = await loadMain({ mainWindow });

  handlers["second-instance"]({}, []);

  assert.deepEqual(calls, ["show", "focus"]);
});

test("forwards due alarms to the main window over alarm:due", async () => {
  const sends = [];
  const mainWindow = {
    webContents: {
      send(channel, payload) {
        sends.push([channel, payload]);
      },
    },
  };
  const { state } = await loadMain({ mainWindow });
  const payload = { id: "alarm-1", label: "Alarm" };

  state.notificationRuntime.options.onAlarmFired(payload);

  assert.deepEqual(sends, [["alarm:due", payload]]);
});

test("open-path only forwards sanitized route hashes", async () => {
  const { state } = await loadMain();

  state.ipcHandlers["open-path"]({}, "#/calendar");
  state.ipcHandlers["open-path"]({}, "/calendar");
  state.ipcHandlers["open-path"]({}, "#/../calendar");
  state.ipcHandlers["open-path"]({}, "C:\\temp\\calendar");
  state.ipcHandlers["open-path"]({}, "#/calendar/details");

  assert.deepEqual(state.openPathCalls, ["#/calendar"]);
});
