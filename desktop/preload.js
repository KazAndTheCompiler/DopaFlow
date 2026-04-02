const { contextBridge, ipcRenderer } = require("electron");

const sendChannels = new Set(["df:install-update", "open-path", "open-journal", "open-calendar", "focus-completed"]);
const onChannels = new Set(["df:update-available", "df:update-downloaded", "df:build-info", "notification-count", "deep-link", "alarm-fired", "focus-notification-shown"]);

contextBridge.exposeInMainWorld("dopaflow", {
  send(channel, payload) {
    if (sendChannels.has(channel)) {
      ipcRenderer.send(channel, payload);
    }
  },
  on(channel, callback) {
    if (!onChannels.has(channel)) {
      return () => undefined;
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  invoke(channel, payload) {
    if (channel === "df:get-build-info") {
      return ipcRenderer.invoke(channel, payload);
    }
    return Promise.resolve(undefined);
  },
});
