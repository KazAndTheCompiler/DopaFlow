const path = require("node:path");

const ALLOWED_OPEN_PATH_ROUTE_IDS = new Set([
  "plan",
  "today",
  "tasks",
  "board",
  "search",
  "habits",
  "focus",
  "review",
  "journal",
  "calendar",
  "alarms",
  "nutrition",
  "digest",
  "player",
  "overview",
  "gamification",
  "insights",
  "goals",
  "commands",
  "shutdown",
  "settings",
]);

function isAbsolutePathLike(value) {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

function sanitizeOpenPathPayload(routePath) {
  if (typeof routePath !== "string") {
    return null;
  }

  const trimmed = routePath.trim();
  if (!trimmed || trimmed.includes("..") || isAbsolutePathLike(trimmed)) {
    return null;
  }

  const match = /^#\/([a-z0-9-]+)$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  const routeId = match[1].toLowerCase();
  if (!ALLOWED_OPEN_PATH_ROUTE_IDS.has(routeId)) {
    return null;
  }

  return `#/${routeId}`;
}

module.exports = {
  sanitizeOpenPathPayload,
};
