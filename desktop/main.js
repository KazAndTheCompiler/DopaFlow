const http = require("node:http");
const path = require("node:path");
const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const AutoLaunch = require("electron-auto-launch");
const pkg = require("./package.json");

const { BackendRuntime } = require("./backend-runtime");

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
}

let tray = null;
let mainWindow = null;
let journalWindow = null;
let unreadCount = 0;
let pollHandle = null;
let alarmPollHandle = null;
let dueAlarmsPollHandle = null;
const firedAlarms = new Map(); // { id -> { id, firedAt } }

const isPackaged = app.isPackaged;
const backendCommand = isPackaged
  ? path.join(process.resourcesPath, "dopaflow-backend", "dopaflow-backend")
  : path.join(__dirname, "..", ".venv", "bin", "python3");
const backendArgs = isPackaged ? [] : ["-m", "app.main"];
const backendCwd = isPackaged
  ? path.join(process.resourcesPath, "dopaflow-backend")
  : path.join(__dirname, "..", "backend");

const runtime = new BackendRuntime({
  cwd: backendCwd,
  command: backendCommand,
  args: backendArgs,
  env: { ...process.env, DOPAFLOW_DEV_AUTH: "1" },
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

function createWindow(route = "#/today", key = "main") {
  const window = new BrowserWindow({
    width: key === "journal" ? 980 : 1440,
    height: key === "journal" ? 860 : 880,
    show: false,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
    if (!isPackaged) {
      window.webContents.openDevTools();
    }
  });
  if (isPackaged) {
    window.loadFile(path.join(process.resourcesPath, "frontend", "dist", "index.html"), { hash: route.replace(/^#/, "") });
  } else {
    window.loadURL(`http://127.0.0.1:5173/${route}`);
  }
  return window;
}

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
      { label: "Open DopaFlow", click: () => mainWindow?.show() },
      { label: "Open Journal", click: () => openJournalWindow() },
      { label: "Open Calendar", click: () => openCalendar() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

function pushUnreadCount() {
  if (typeof app.setBadgeCount === "function") {
    app.setBadgeCount(unreadCount);
  }
  mainWindow?.webContents.send("notification-count", unreadCount);
  journalWindow?.webContents.send("notification-count", unreadCount);
  updateTray();
}

function pushBuildInfo() {
  const payload = getBuildInfo();
  mainWindow?.webContents.send("df:build-info", payload);
  journalWindow?.webContents.send("df:build-info", payload);
}

function fetchUnreadCount() {
  const request = http.get("http://127.0.0.1:8000/api/v2/notifications/unread-count", (response) => {
    let body = "";
    response.on("data", (chunk) => {
      body += chunk.toString();
    });
    response.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        unreadCount = Number(parsed.count ?? 0);
        pushUnreadCount();
      } catch (_error) {
        unreadCount = 0;
        pushUnreadCount();
      }
    });
  });

  request.on("error", () => {
    unreadCount = 0;
    pushUnreadCount();
  });
}

function fetchDueAlarms() {
  const request = http.get("http://127.0.0.1:8000/api/v2/alarms/upcoming", (response) => {
    let body = "";
    response.on("data", (chunk) => {
      body += chunk.toString();
    });
    response.on("end", () => {
      try {
        const alarms = JSON.parse(body);
        if (!Array.isArray(alarms)) {
          return;
        }
        const now = Date.now();
        alarms.forEach((alarm) => {
          const alarmAt = new Date(alarm.at).getTime();
          if (!Number.isFinite(alarmAt) || alarm.muted) {
            return;
          }
          const delta = alarmAt - now;
          if (delta < 0 || delta > 90_000 || firedAlarms.has(alarm.id)) {
            return;
          }
          firedAlarms.set(alarm.id, { id: alarm.id, firedAt: now });
          const alarm_notif = new Notification({
            title: "DopaFlow Alarm",
            body: alarm.title ?? "Alarm",
            silent: false,
          });
          alarm_notif.on("click", () => {
            mainWindow?.show();
            mainWindow?.focus();
          });
          alarm_notif.show();
          mainWindow?.webContents.send("alarm-fired", { id: alarm.id, label: alarm.title ?? "Alarm" });
        });
      } catch (_error) {
        // Ignore transient parse/network failures, same as unread polling.
      }
    });
  });

  request.on("error", () => undefined);
}

function cleanupFiredAlarms() {
  const now = Date.now();
  const fiveMinutesMs = 5 * 60 * 1000;
  for (const [id, record] of firedAlarms.entries()) {
    if (now - record.firedAt > fiveMinutesMs) {
      firedAlarms.delete(id);
    }
  }
}

function fetchDueAlarmsPolling() {
  fetch("http://127.0.0.1:8000/api/v2/alarms/due")
    .then((response) => response.json())
    .then((alarms) => {
      if (!Array.isArray(alarms)) {
        return;
      }
      alarms.forEach((alarm) => {
        if (!firedAlarms.has(alarm.id)) {
          firedAlarms.set(alarm.id, { id: alarm.id, firedAt: Date.now() });
          const alarm_notif = new Notification({
            title: alarm.label ?? "Alarm",
            body: alarm.time_str ?? "",
            silent: false,
          });
          alarm_notif.on("click", () => {
            mainWindow?.show();
            mainWindow?.focus();
          });
          alarm_notif.show();
        }
      });
      cleanupFiredAlarms();
    })
    .catch(() => {
      // Backend may not be running yet, log and continue
    });
}

function startNotificationPolling() {
  fetchUnreadCount();
  pollHandle = setInterval(fetchUnreadCount, 10_000);
  fetchDueAlarms();
  alarmPollHandle = setInterval(fetchDueAlarms, 30_000);
  fetchDueAlarmsPolling();
  dueAlarmsPollHandle = setInterval(fetchDueAlarmsPolling, 60_000);
}

function stopNotificationPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  if (alarmPollHandle) {
    clearInterval(alarmPollHandle);
    alarmPollHandle = null;
  }
  if (dueAlarmsPollHandle) {
    clearInterval(dueAlarmsPollHandle);
    dueAlarmsPollHandle = null;
  }
}

function openJournalWindow() {
  if (journalWindow && !journalWindow.isDestroyed()) {
    journalWindow.focus();
    return;
  }
  journalWindow = createWindow("#/journal", "journal");
}

function openCalendar() {
  if (!mainWindow) {
    mainWindow = createWindow("#/calendar", "main");
    return;
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("deep-link", "dopaflow://calendar");
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+D", () => {
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
  ipcMain.on("open-journal", () => openJournalWindow());
  ipcMain.on("open-calendar", () => openCalendar());
  ipcMain.on("open-path", (_event, routePath) => {
    if (!mainWindow) {
      mainWindow = createWindow(routePath, "main");
      return;
    }
    mainWindow.show();
    if (isPackaged) {
      mainWindow.loadFile(path.join(process.resourcesPath, "frontend", "dist", "index.html"), { hash: routePath.replace(/^#/, "") });
    } else {
      mainWindow.loadURL(`http://127.0.0.1:5173/${routePath}`);
    }
  });
  ipcMain.on("focus-completed", (_event, data) => {
    const focus_notif = new Notification({
      title: "Focus Session Complete",
      body: data.message || "Great work! Take a break.",
      silent: false,
    });
    focus_notif.on("click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
    focus_notif.show();
    mainWindow?.webContents.send("focus-notification-shown", { session_id: data.session_id });
  });
}

function ensureMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow("#/today", "main");
    mainWindow.webContents.once("did-finish-load", () => {
      pushBuildInfo();
    });
  }
  return mainWindow;
}

if (singleInstance) {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((value) => value.startsWith("dopaflow://"));
    const window = ensureMainWindow();
    window.show();
    window.focus();
    if (deepLink) {
      window.webContents.send("deep-link", deepLink);
    }
  });
}

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient("dopaflow");
  new AutoLaunch({ name: "DopaFlow" });

  runtime.start();
  runtime.on("ready", () => {
    ensureMainWindow();
    startNotificationPolling();
  });

  tray = new Tray(path.join(__dirname, "assets", "icon.png"));
  updateTray();
  registerShortcuts();
  setupIpc();

  autoUpdater.on("update-available", (info) => {
    ensureMainWindow().webContents.send("df:update-available", { version: info.version });
  });
  autoUpdater.on("update-downloaded", () => {
    ensureMainWindow().webContents.send("df:update-downloaded");
  });
  if (autoUpdateEnabled) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  ensureMainWindow().webContents.send("deep-link", url);
});

app.on("will-quit", () => {
  stopNotificationPolling();
  globalShortcut.unregisterAll();
  runtime.stop();
});
