const { contextBridge, ipcRenderer } = require("electron");

// Inlined from ipc-validation.js — sandboxed preload cannot require local modules
const ALLOWED_OPEN_PATH_ROUTE_IDS = new Set([
  "plan", "today", "tasks", "board", "search", "habits", "focus",
  "review", "journal", "calendar", "alarms", "nutrition", "digest",
  "player", "overview", "gamification", "insights", "goals",
  "commands", "shutdown", "settings",
]);

function sanitizeOpenPathPayload(routePath) {
  if (typeof routePath !== "string") return null;
  const trimmed = routePath.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed)) return null;
  const match = /^#\/([a-z0-9-]+)$/i.exec(trimmed);
  if (!match) return null;
  const routeId = match[1].toLowerCase();
  if (!ALLOWED_OPEN_PATH_ROUTE_IDS.has(routeId)) return null;
  return `#/${routeId}`;
}

const sendChannels = new Set(["df:install-update", "open-path", "open-journal", "open-calendar", "focus-completed"]);
const onChannels = new Set(["df:update-available", "df:update-downloaded", "df:build-info", "notification-count", "deep-link", "alarm:due", "focus-notification-shown"]);

contextBridge.exposeInMainWorld("dopaflow", {
  send(channel, payload) {
    if (!sendChannels.has(channel)) return;
    if (channel === "open-path") {
      const safePayload = sanitizeOpenPathPayload(payload);
      if (!safePayload) return;
      ipcRenderer.send(channel, safePayload);
      return;
    }
    ipcRenderer.send(channel, payload);
  },
  on(channel, callback) {
    if (!onChannels.has(channel)) return () => undefined;
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  invoke(channel, payload) {
    if (channel === "df:get-build-info") return ipcRenderer.invoke(channel, payload);
    return Promise.resolve(undefined);
  },
});
