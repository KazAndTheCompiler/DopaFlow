import { expect, test } from "@playwright/test";

const apiBase = "**/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function mockShellApis(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("dopaflow_onboarded", "1");
    window.localStorage.setItem("zoestm_planned_date", new Date().toISOString().slice(0, 10));
  });

  await page.route(`${apiBase}/tasks**`, async (route) => {
    const url = route.request().url();
    if (url.includes("/boards/")) {
      await route.fulfill(json([]));
      return;
    }
    await route.fulfill(json([
      {
        id: "tsk_1",
        title: "Breakpoints stay visible",
        description: null,
        due_at: new Date().toISOString(),
        priority: 1,
        status: "todo",
        done: false,
        estimated_minutes: 30,
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
    ]));
  });
  await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
  await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "Keep the shell clean.", tone: "helpful", suggested_action: null })));
  await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
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
}

test.describe("Shell breakpoint regression", () => {
  test("desktop shell keeps sidebar and task create controls visible", async ({ page }) => {
    await mockShellApis(page);
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("http://127.0.0.1:4173/#/tasks");

    await expect(page.getByTestId("shell-root")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sidebar-desktop")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("shell-main")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder("Quick add — type or speak")).toBeVisible({ timeout: 15_000 });
  });

  test("mobile shell exposes the drawer and keeps navigation reachable", async ({ page }) => {
    await mockShellApis(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/#/today");

    await expect(page.getByTestId("mobile-nav")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "More" }).click();
    const mobileDrawer = page.getByTestId("mobile-drawer");
    await expect(mobileDrawer).toBeVisible({ timeout: 15_000 });
    await expect(mobileDrawer.getByRole("button", { name: "Tasks" })).toBeVisible({ timeout: 15_000 });
  });

  test("command palette remains reachable from the shell", async ({ page, browserName }) => {
    await mockShellApis(page);
    await page.goto("http://127.0.0.1:4173/#/today");

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

    await expect(page.getByTestId("command-palette")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder("Type a command... (add task, focus, list habits)")).toBeVisible({ timeout: 15_000 });
  });
});
