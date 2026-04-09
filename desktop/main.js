const path = require("node:path");
const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const AutoLaunch = require("electron-auto-launch");
const pkg = require("./package.json");

const { BackendRuntime } = require("./backend-runtime");
const { NotificationRuntime } = require("./notification-runtime");
const { buildBackendEnv } = require("./runtime-auth");
const { WindowRuntime } = require("./window-runtime");

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
}

let tray = null;
let unreadCount = 0;

const isPackaged = app.isPackaged;
const backendCommand = isPackaged
  ? path.join(process.resourcesPath, "dopaflow-backend", "dopaflow-backend")
  : path.join(__dirname, "..", ".venv", "bin", "python3");
const backendArgs = isPackaged ? [] : ["-m", "app.main"];
const backendCwd = isPackaged
  ? path.join(process.resourcesPath, "dopaflow-backend")
  : path.join(__dirname, "..", "backend");
const backendEnv = buildBackendEnv(process.env, { isPackaged });

const runtime = new BackendRuntime({
  cwd: backendCwd,
  command: backendCommand,
  args: backendArgs,
  env: backendEnv,
});

const releaseChannel = pkg.dopaflowReleaseChannel === "stable" ? "stable" : "dev";
const autoUpdateEnabled = isPackaged && releaseChannel === "stable";

function getBuildInfo() {
  return {
    version: app.getVersion?.() ?? pkg.version,
    releaseChannel,
    autoUpdateEnabled,
    updateSource: autoUpdateEnabled ? "github-releases" : "manual",
  };
}

let windowRuntime = null;

function updateTray() {
  if (!tray) {
    return;
  }

  const buildLabel = releaseChannel === "stable" ? "Stable" : "Dev";
  tray.setToolTip(`DopaFlow ${buildLabel}${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`);
  if (typeof tray.setTitle === "function") {
    tray.setTitle(unreadCount > 0 ? String(unreadCount) : "");
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open DopaFlow", click: () => windowRuntime?.focusMainWindow() },
      { label: "Open Journal", click: () => windowRuntime?.openJournalWindow() },
      { label: "Open Calendar", click: () => windowRuntime?.openCalendar() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

function pushUnreadCount() {
  if (typeof app.setBadgeCount === "function") {
    app.setBadgeCount(unreadCount);
  }
  windowRuntime?.sendToAll("notification-count", unreadCount);
  updateTray();
}

function pushBuildInfo() {
  const payload = getBuildInfo();
  windowRuntime?.sendToAll("df:build-info", payload);
}

const notificationRuntime = new NotificationRuntime({
  Notification,
  onUnreadCount: (count) => {
    unreadCount = count;
    pushUnreadCount();
  },
  onAlarmFired: (alarm) => {
    windowRuntime?.getMainWindow()?.webContents.send("alarm-fired", alarm);
  },
  focusMainWindow: () => {
    windowRuntime?.focusMainWindow();
  },
});

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+D", () => {
    const mainWindow = windowRuntime?.getMainWindow();
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function setupIpc() {
  ipcMain.handle("df:get-build-info", () => getBuildInfo());
  ipcMain.on("df:install-update", () => {
    if (autoUpdateEnabled) {
      autoUpdater.quitAndInstall();
    }
  });
  ipcMain.on("open-journal", () => windowRuntime?.openJournalWindow());
  ipcMain.on("open-calendar", () => windowRuntime?.openCalendar());
  ipcMain.on("open-path", (_event, routePath) => {
    windowRuntime?.openPath(routePath);
  });
  ipcMain.on("focus-completed", (_event, data) => {
    const focus_notif = new Notification({
      title: "Focus Session Complete",
      body: data.message || "Great work! Take a break.",
      silent: false,
    });
    focus_notif.on("click", () => {
      windowRuntime?.focusMainWindow();
    });
    focus_notif.show();
    windowRuntime?.getMainWindow()?.webContents.send("focus-notification-shown", { session_id: data.session_id });
  });
}

if (singleInstance) {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((value) => value.startsWith("dopaflow://"));
    if (deepLink) {
      windowRuntime?.openDeepLink(deepLink);
      return;
    }
    windowRuntime?.focusMainWindow();
  });
}

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient("dopaflow");
  new AutoLaunch({ name: "DopaFlow" });
  windowRuntime = new WindowRuntime({
    BrowserWindow,
    isPackaged,
    assetsDir: path.join(__dirname, "assets"),
    preloadPath: path.join(__dirname, "preload.js"),
    frontendDistPath: path.join(process.resourcesPath, "frontend", "dist", "index.html"),
    devServerOrigin: "http://127.0.0.1:5173",
    openExternal: (url) => shell.openExternal(url),
    onMainReady: () => pushBuildInfo(),
  });

  runtime.start();
  runtime.on("ready", () => {
    windowRuntime.ensureMainWindow();
    notificationRuntime.start();
  });

  tray = new Tray(path.join(__dirname, "assets", "icon.png"));
  updateTray();
  registerShortcuts();
  setupIpc();

  autoUpdater.on("update-available", (info) => {
    windowRuntime.ensureMainWindow().webContents.send("df:update-available", { version: info.version });
  });
  autoUpdater.on("update-downloaded", () => {
    windowRuntime.ensureMainWindow().webContents.send("df:update-downloaded");
  });
  if (autoUpdateEnabled) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  windowRuntime?.openDeepLink(url);
});

app.on("will-quit", () => {
  notificationRuntime.stop();
  globalShortcut.unregisterAll();
  runtime.stop();
});
