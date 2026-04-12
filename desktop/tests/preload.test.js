const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const preloadPath = path.join(__dirname, "..", "preload.js");

function loadPreload() {
  const originalLoad = Module._load;
  const state = {
    sent: [],
    listeners: [],
    exposed: null,
  };

  Module._load = function mockLoad(request, parent, isMain) {
    if (request === "electron") {
      return {
        contextBridge: {
          exposeInMainWorld(_name, api) {
            state.exposed = api;
          },
        },
        ipcRenderer: {
          send(channel, payload) {
            state.sent.push([channel, payload]);
          },
          on(channel, listener) {
            state.listeners.push([channel, listener]);
          },
          removeListener() {},
          invoke() {
            return Promise.resolve(undefined);
          },
        },
      };
    }
    return originalLoad(request, parent, isMain);
  };

  delete require.cache[require.resolve(preloadPath)];

  try {
    require(preloadPath);
    return state;
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve(preloadPath)];
  }
}

test("preload send rejects unsafe open-path payloads", () => {
  const state = loadPreload();

  state.exposed.send("open-path", "#/calendar");
  state.exposed.send("open-path", "/calendar");
  state.exposed.send("open-path", "#/../calendar");
  state.exposed.send("open-path", "/tmp/calendar");
  state.exposed.send("open-path", "C:\\temp\\calendar");

  assert.deepEqual(state.sent, [["open-path", "#/calendar"]]);
});
