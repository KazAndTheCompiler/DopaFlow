const path = require("node:path");

const SAFE_HASH_ROUTE = /^#\/[a-z0-9/_-]*$/i;

function normalizeRoutePath(routePath) {
  if (typeof routePath !== "string") {
    return "#/today";
  }

  const trimmed = routePath.trim();
  if (!trimmed) {
    return "#/today";
  }

  if (trimmed.startsWith("dopaflow://")) {
    return normalizeDeepLink(trimmed) ?? "#/today";
  }

  const candidate = trimmed.startsWith("#") ? trimmed : trimmed.startsWith("/") ? `#${trimmed}` : "#/today";
  return SAFE_HASH_ROUTE.test(candidate) ? candidate : "#/today";
}

function normalizeDeepLink(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "dopaflow:") {
      return null;
    }
    const routeSegments = [parsed.hostname, ...parsed.pathname.split("/").filter(Boolean)].filter(Boolean);
    if (routeSegments.length === 0) {
      return "#/today";
    }
    const route = `#/${routeSegments.join("/")}`;
    return SAFE_HASH_ROUTE.test(route) ? route : null;
  } catch {
    return null;
  }
}

function isTrustedNavigationUrl(rawUrl, options = {}) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return false;
  }

  const { isPackaged = false, devServerOrigin = "http://127.0.0.1:5173", frontendDistPath } = options;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "about:") {
      return parsed.href === "about:blank";
    }
    if (isPackaged) {
      const expectedPath = typeof frontendDistPath === "string" ? path.resolve(frontendDistPath) : "";
      return parsed.protocol === "file:" && expectedPath !== "" && path.resolve(parsed.pathname) === expectedPath;
    }
    const devOrigin = new URL(devServerOrigin);
    return parsed.origin === devOrigin.origin;
  } catch {
    return false;
  }
}

class WindowRuntime {
  /** Manage Electron window creation, route loading, and auxiliary window helpers. */
  constructor(options = {}) {
    this.BrowserWindow = options.BrowserWindow;
    this.isPackaged = options.isPackaged ?? false;
    this.assetsDir = options.assetsDir;
    this.preloadPath = options.preloadPath;
    this.frontendDistPath = options.frontendDistPath;
    this.devServerOrigin = options.devServerOrigin ?? "http://127.0.0.1:5173";
    this.onMainReady = options.onMainReady ?? (() => undefined);
    this.openExternal = options.openExternal ?? (() => undefined);

    this.mainWindow = null;
    this.journalWindow = null;
  }

  loadRoute(window, routePath) {
    const safeRoute = normalizeRoutePath(routePath);
    if (this.isPackaged) {
      window.loadFile(this.frontendDistPath, { hash: safeRoute.replace(/^#/, "") });
      return;
    }
    window.loadURL(`${this.devServerOrigin}/${safeRoute}`);
  }

  createWindow(route = "#/today", key = "main") {
    const window = new this.BrowserWindow({
      width: key === "journal" ? 980 : 1440,
      height: key === "journal" ? 860 : 880,
      show: false,
      icon: path.join(this.assetsDir, "icon.png"),
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isTrustedNavigationUrl(url, {
        isPackaged: this.isPackaged,
        devServerOrigin: this.devServerOrigin,
        frontendDistPath: this.frontendDistPath,
      })) {
        return { action: "allow" };
      }
      void this.openExternal(url);
      return { action: "deny" };
    });

    window.webContents.on("will-navigate", (event, url) => {
      if (isTrustedNavigationUrl(url, {
        isPackaged: this.isPackaged,
        devServerOrigin: this.devServerOrigin,
        frontendDistPath: this.frontendDistPath,
      })) {
        return;
      }
      event.preventDefault();
      void this.openExternal(url);
    });

    window.once("ready-to-show", () => {
      window.show();
      if (!this.isPackaged) {
        window.webContents.openDevTools();
      }
    });

    this.loadRoute(window, route);
    return window;
  }

  ensureMainWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.mainWindow = this.createWindow("#/today", "main");
      this.mainWindow.webContents.once("did-finish-load", () => {
        this.onMainReady();
      });
    }
    return this.mainWindow;
  }

  getMainWindow() {
    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
  }

  getJournalWindow() {
    return this.journalWindow && !this.journalWindow.isDestroyed() ? this.journalWindow : null;
  }

  focusMainWindow() {
    const window = this.ensureMainWindow();
    window.show();
    window.focus();
    return window;
  }

  openJournalWindow() {
    const window = this.getJournalWindow();
    if (window) {
      window.focus();
      return window;
    }
    this.journalWindow = this.createWindow("#/journal", "journal");
    return this.journalWindow;
  }

  openCalendar() {
    const window = this.focusMainWindow();
    this.loadRoute(window, "#/calendar");
    return window;
  }

  openPath(routePath) {
    const window = this.focusMainWindow();
    this.loadRoute(window, routePath);
    return window;
  }

  openDeepLink(rawUrl) {
    const safeRoute = normalizeDeepLink(rawUrl);
    const window = this.focusMainWindow();
    if (safeRoute) {
      this.loadRoute(window, safeRoute);
    }
    return window;
  }

  sendToAll(channel, payload) {
    this.getMainWindow()?.webContents.send(channel, payload);
    this.getJournalWindow()?.webContents.send(channel, payload);
  }
}

module.exports = { WindowRuntime, normalizeRoutePath, normalizeDeepLink, isTrustedNavigationUrl };
