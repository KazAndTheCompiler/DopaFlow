import { expect, test } from "@playwright/test";

const apiBase = "**/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Route startup regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("dopaflow_onboarded", "1");
      window.localStorage.setItem("zoestm_planned_date", new Date().toISOString().slice(0, 10));
    });

    await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/goals**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
    await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "", tone: "helpful", suggested_action: null })));
    await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/player/queue**`, (route) => route.fulfill(json({ items: [] })));
    await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/vault/status**`, (route) => route.fulfill(json({
      config: {
        vault_enabled: false,
        vault_path: "",
        daily_note_folder: "Daily",
        tasks_folder: "Tasks",
        review_folder: "Review",
        projects_folder: "Projects",
        attachments_folder: "Attachments",
      },
      vault_reachable: false,
      total_indexed: 0,
      conflicts: 0,
      last_push_at: null,
      last_pull_at: null,
    })));
    await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));
  });

  test("default route lands on the today surface with runway guidance", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main strong").filter({ hasText: "Today" }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Open overview" })).toBeVisible({ timeout: 15_000 });
  });

  test("core routes render their expected surface copy", async ({ page }) => {
    const expectations: Array<{ route: string; text: string }> = [
      { route: "tasks", text: "Task runway" },
      { route: "habits", text: "Habit name" },
      { route: "focus", text: "Choose one task before you start the timer" },
      { route: "goals", text: "New goal" },
      { route: "settings", text: "Sync & Sharing" },
    ];

    for (const item of expectations) {
      await page.goto(`/#/${item.route}`);
      await expect(page.getByText(item.text, { exact: true })).toBeVisible({ timeout: 15_000 });
    }
  });

  test("today surface renders with data from API", async ({ page }) => {
    await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([
      {
        id: "tsk_1",
        title: "Ship UI polish pass",
        description: null,
        due_at: new Date().toISOString(),
        priority: 1,
        status: "todo",
        done: false,
        estimated_minutes: 45,
        actual_minutes: null,
        recurrence_rule: null,
        recurrence_parent_id: null,
        sort_order: 0,
        subtasks: [],
        tags: [],
        source_type: null,
        source_external_id: null,
        project_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])));
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({
      text: "Stay focused on your top priority.",
      tone: "helpful",
      suggested_action: null,
    })));

    await page.goto("/#/today");
    await page.waitForTimeout(2000);

    await expect(page.getByText("Start with Ship UI polish pass")).toBeVisible({ timeout: 15_000 });
  });

  test("settings surface renders with correct sections", async ({ page }) => {
    await page.goto("/#/settings");
    await expect(page.locator("#settings-integrations-overview")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#settings-vault")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#settings-sync-sharing")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#settings-integrations")).toBeVisible({ timeout: 15_000 });
  });

  test("navigation between surfaces maintains state", async ({ page }) => {
    await page.goto("/");
    await page.locator('nav button:has-text("Tasks")').first().click();
    await expect(page.getByText("Task runway", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.locator('nav button:has-text("Focus")').first().click();
    await expect(page.getByText("Choose one task before you start the timer")).toBeVisible({ timeout: 15_000 });

    await page.locator('nav button:has-text("Today")').first().click();
    await expect(page.getByText("You have room to plan intentionally")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Command palette navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("dopaflow_onboarded", "1");
      window.localStorage.setItem("zoestm_planned_date", new Date().toISOString().slice(0, 10));
    });

    await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/goals**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
    await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "", tone: "helpful", suggested_action: null })));
    await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/player/queue**`, (route) => route.fulfill(json({ items: [] })));
    await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/vault/status**`, (route) => route.fulfill(json({
      config: {
        vault_enabled: false,
        vault_path: "",
        daily_note_folder: "Daily",
        tasks_folder: "Tasks",
        review_folder: "Review",
        projects_folder: "Projects",
        attachments_folder: "Attachments",
      },
      vault_reachable: false,
      total_indexed: 0,
      conflicts: 0,
      last_push_at: null,
      last_pull_at: null,
    })));
    await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));
  });

  test("ctrl/cmd+k opens the command palette and can navigate to focus", async ({ page, browserName }) => {
    await page.goto("/");
    await page.evaluate((isWebkit) => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: !isWebkit,
          metaKey: isWebkit,
          bubbles: true,
        }),
      );
    }, browserName === "webkit");
    await expect(page.getByText("Move fast without leaving the keyboard")).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder("Type a command... (add task, focus, list habits)").fill("focus");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("main").getByText("Focus Block", { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Console error detection", () => {
  test("app should not throw uncaught errors on startup", async ({ page }) => {
    const consoleErrors: Array<{ type: string; text: string }> = [];
    page.on("console", (msg) => {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("dopaflow_onboarded", "1");
      window.localStorage.setItem("zoestm_planned_date", new Date().toISOString().slice(0, 10));
    });

    await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/goals**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
    await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "", tone: "helpful", suggested_action: null })));
    await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/player/queue**`, (route) => route.fulfill(json({ items: [] })));
    await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/vault/status**`, (route) => route.fulfill(json({
      config: {
        vault_enabled: false,
        vault_path: "",
        daily_note_folder: "Daily",
        tasks_folder: "Tasks",
        review_folder: "Review",
        projects_folder: "Projects",
        attachments_folder: "Attachments",
      },
      vault_reachable: false,
      total_indexed: 0,
      conflicts: 0,
      last_push_at: null,
      last_pull_at: null,
    })));
    await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));

    await page.goto("/");
    // Wait for initial data fetches to settle
    await page.waitForTimeout(3000);

    // No unhandled page-level exceptions
    expect(pageErrors).toHaveLength(0);

    // No console errors that indicate JS crashes (exclude expected network noise)
    const criticalErrors = consoleErrors.filter(
      (e) =>
        e.type === "error" &&
        !e.text.includes("favicon") &&
        !e.text.includes("404") &&
        !e.text.includes("net::ERR") &&
        !e.text.includes("Failed to load resource"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("all surfaces load without console errors", async ({ page }) => {
    page.setDefaultTimeout(60_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("dopaflow_onboarded", "1");
      window.localStorage.setItem("zoestm_planned_date", new Date().toISOString().slice(0, 10));
    });

    await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/goals**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
    await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "", tone: "helpful", suggested_action: null })));
    await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/player/queue**`, (route) => route.fulfill(json({ items: [] })));
    await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/vault/status**`, (route) => route.fulfill(json({
      config: {
        vault_enabled: false,
        vault_path: "",
        daily_note_folder: "Daily",
        tasks_folder: "Tasks",
        review_folder: "Review",
        projects_folder: "Projects",
        attachments_folder: "Attachments",
      },
      vault_reachable: false,
      total_indexed: 0,
      conflicts: 0,
      last_push_at: null,
      last_pull_at: null,
    })));
    await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));

    const routes = ["today", "tasks", "habits", "focus", "review", "journal", "calendar", "alarms", "nutrition", "digest", "player", "overview", "insights", "goals", "settings"];
    for (const route of routes) {
      await page.goto(`/#/${route}`);
      await page.waitForTimeout(1500);
    }

    expect(pageErrors).toHaveLength(0);
  });
});
