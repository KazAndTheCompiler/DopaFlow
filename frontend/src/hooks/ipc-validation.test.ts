import { describe, expect, it } from "vitest";
import path from "path";

const ALLOWED_OPEN_PATH_ROUTE_IDS = new Set([
  "plan", "today", "tasks", "board", "search", "habits",
  "focus", "review", "journal", "calendar", "alarms",
  "nutrition", "digest", "player", "overview", "gamification",
  "insights", "goals", "commands", "shutdown", "settings",
]);

function isAbsolutePathLike(value: string) {
  return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

function sanitizeOpenPathPayload(routePath: unknown): string | null {
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

describe("sanitizeOpenPathPayload", () => {
  it("returns null for non-string input", () => {
    expect(sanitizeOpenPathPayload(null)).toBeNull();
    expect(sanitizeOpenPathPayload(123)).toBeNull();
    expect(sanitizeOpenPathPayload(undefined)).toBeNull();
    expect(sanitizeOpenPathPayload({})).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(sanitizeOpenPathPayload("")).toBeNull();
    expect(sanitizeOpenPathPayload("   ")).toBeNull();
  });

  it("returns null for absolute paths", () => {
    expect(sanitizeOpenPathPayload("/etc/passwd")).toBeNull();
    expect(sanitizeOpenPathPayload("C:\\Users\\test")).toBeNull();
  });

  it("returns null for path traversal", () => {
    expect(sanitizeOpenPathPayload("../etc/passwd")).toBeNull();
    expect(sanitizeOpenPathPayload("foo/../../etc/passwd")).toBeNull();
  });

  it("returns null for non-route patterns", () => {
    expect(sanitizeOpenPathPayload("just some text")).toBeNull();
    expect(sanitizeOpenPathPayload("#")).toBeNull();
    expect(sanitizeOpenPathPayload("#/")).toBeNull();
    expect(sanitizeOpenPathPayload("#/tasks/123")).toBeNull();
  });

  it("returns null for unknown route IDs", () => {
    expect(sanitizeOpenPathPayload("#/unknown-route")).toBeNull();
    expect(sanitizeOpenPathPayload("#/fake")).toBeNull();
    expect(sanitizeOpenPathPayload("#/TASKS")).toBeNull();
  });

  it("returns normalized route for all valid known routes", () => {
    const validRoutes = [
      "plan", "today", "tasks", "board", "search", "habits",
      "focus", "review", "journal", "calendar", "alarms",
      "nutrition", "digest", "player", "overview", "gamification",
      "insights", "goals", "commands", "shutdown", "settings",
    ];
    for (const route of validRoutes) {
      expect(sanitizeOpenPathPayload(`#/${route}`)).toBe(`#/${route}`);
    }
  });

  it("normalizes route ID to lowercase", () => {
    expect(sanitizeOpenPathPayload("#/TASKS")).toBe("#/tasks");
    expect(sanitizeOpenPathPayload("#/Focus")).toBe("#/focus");
    expect(sanitizeOpenPathPayload("#/CALENDAR")).toBe("#/calendar");
  });

  it("returns null for valid route with extra segments", () => {
    expect(sanitizeOpenPathPayload("#/tasks/subtask")).toBeNull();
    expect(sanitizeOpenPathPayload("#/tasks?query=1")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(sanitizeOpenPathPayload("  #/tasks  ")).toBe("#/tasks");
  });
});
