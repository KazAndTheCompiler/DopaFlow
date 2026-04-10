function buildBackendEnv(baseEnv = {}, options = {}) {
  const isPackaged = options.isPackaged === true;
  const env = { ...baseEnv };

  if (isPackaged) {
    delete env.DOPAFLOW_DEV_AUTH;
    env.DOPAFLOW_TRUST_LOCAL_CLIENTS = "1";
    return env;
  }

  if (env.DOPAFLOW_DEV_AUTH === "1" || env.DOPAFLOW_DEV_AUTH === "true") {
    env.DOPAFLOW_DEV_AUTH = "1";
    return env;
  }

  delete env.DOPAFLOW_DEV_AUTH;
  return env;
}

module.exports = { buildBackendEnv };
