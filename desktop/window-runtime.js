const path = require("node:path");

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

    this.mainWindow = null;
    this.journalWindow = null;
  }

  loadRoute(window, routePath) {
    if (this.isPackaged) {
      window.loadFile(this.frontendDistPath, { hash: routePath.replace(/^#/, "") });
      return;
    }
    window.loadURL(`${this.devServerOrigin}/${routePath}`);
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
    window.webContents.send("deep-link", "dopaflow://calendar");
    return window;
  }

  openPath(routePath) {
    const window = this.focusMainWindow();
    this.loadRoute(window, routePath);
    return window;
  }

  sendToAll(channel, payload) {
    this.getMainWindow()?.webContents.send(channel, payload);
    this.getJournalWindow()?.webContents.send(channel, payload);
  }
}

module.exports = { WindowRuntime };
