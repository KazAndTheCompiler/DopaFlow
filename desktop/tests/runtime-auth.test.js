const test = require("node:test");
const assert = require("node:assert/strict");

const { buildBackendEnv } = require("../runtime-auth");

test("packaged runtime always strips dev auth", () => {
  const env = buildBackendEnv({ DOPAFLOW_DEV_AUTH: "1", OTHER: "ok" }, { isPackaged: true });
  assert.equal(env.DOPAFLOW_DEV_AUTH, undefined);
  assert.equal(env.OTHER, "ok");
});

test("development runtime keeps explicit dev auth opt-in", () => {
  const env = buildBackendEnv({ DOPAFLOW_DEV_AUTH: "true" }, { isPackaged: false });
  assert.equal(env.DOPAFLOW_DEV_AUTH, "1");
});

test("development runtime does not force dev auth when unset", () => {
  const env = buildBackendEnv({ OTHER: "ok" }, { isPackaged: false });
  assert.equal(env.DOPAFLOW_DEV_AUTH, undefined);
  assert.equal(env.OTHER, "ok");
});
