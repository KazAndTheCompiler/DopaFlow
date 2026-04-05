import { expect, test } from "@playwright/test";

const apiBase = "**/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.beforeEach(async ({ page }) => {
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
        title: "Ship UI polish pass",
        description: "Tighten shell and planning surfaces",
        due_at: "2026-04-01T09:00:00Z",
        priority: 1,
        status: "todo",
        done: false,
        estimated_minutes: 45,
        actual_minutes: null,
        recurrence_rule: null,
        recurrence_parent_id: null,
        sort_order: 0,
        subtasks: [],
        tags: ["ui"],
        source_type: null,
        source_external_id: null,
        project_id: null,
        created_at: "2026-04-01T07:00:00Z",
        updated_at: "2026-04-01T07:00:00Z",
      },
    ]));
  });

  await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/focus/sessions/control**`, (route) => route.fulfill(json({ id: "fs_1", status: "completed", task_id: null, started_at: "2026-04-01T08:00:00Z", ended_at: "2026-04-01T08:25:00Z", duration_minutes: 25 })));
  await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/status**`, (route) => route.fulfill(json({ status: "idle" })));
  await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/sync/conflicts**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/sync/status**`, (route) => route.fulfill(json({ ok: true, conflicts: 0, status: "healthy" })));
  await page.route(`${apiBase}/calendar/sharing/tokens**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/sharing/feeds**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([
    {
      id: "ntf_1",
      level: "info",
      title: "Shared calendar synced",
      body: "Your mirrored events are up to date.",
      read: false,
      archived: false,
      created_at: "2026-04-01T08:00:00Z",
      action_url: null,
    },
  ])));
  await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 2 })));
  await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "Keep the surface clean.", tone: "helpful", suggested_action: null })));
  await page.route(`${apiBase}/insights/momentum**`, (route) => route.fulfill(json({ score: 72, delta_vs_yesterday: 4, components: {}, level: "flowing", summary: "Solid momentum." })));
  await page.route(`${apiBase}/insights/weekly-digest**`, (route) => route.fulfill(json({ title: "Weekly snapshot", highlights: ["Momentum is holding steady."] })));
  await page.route(`${apiBase}/insights/correlations**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/gamification/status**`, (route) => route.fulfill(json({
    level: {
      total_xp: 0,
      level: 1,
      xp_to_next: 100,
      progress: 0,
      updated_at: "2026-04-01T08:00:00Z",
    },
    badges: [],
    earned_count: 0,
  })));
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
  await page.route(`${apiBase}/vault/tasks/import-preview**`, (route) => route.fulfill(json({
    importable: [
      {
        title: "Import from vault",
        done: false,
        due_str: "2026-04-05",
        priority: 2,
        tags: ["vault"],
        file_path: "Tasks/Inbox.md",
        line_text: "- [ ] Import from vault",
        line_number: 3,
        project_id: null,
        project_name: null,
        status: "importable",
        known_task_id: null,
      },
    ],
    known: [],
    skipped: 0,
    total_scanned: 1,
  })));
  await page.route(`${apiBase}/vault/tasks/import-confirm**`, (route) => route.fulfill(json({
    imported: 1,
    updated: 0,
    conflicts: 0,
    errors: [],
  })));
  await page.route(`${apiBase}/vault/push/daily-tasks/**`, (route) => route.fulfill(json({
    pushed: 1,
    skipped: 0,
    conflicts: 0,
    errors: [],
  })));
  await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));
});

test("shell renders and inbox opens", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTitle("Notifications")).toBeVisible({ timeout: 15_000 });
  await page.getByTitle("Notifications").click();
  await expect(page.getByText("Notifications")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Shared calendar synced")).toBeVisible({ timeout: 15_000 });
});

test("calendar and settings surfaces render updated UI", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('nav button:has-text("Calendar")').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('nav button:has-text("Calendar")').first().click();
  await expect(page.getByText("Planning surface")).toBeVisible({ timeout: 15_000 });

  await page.locator('nav button:has-text("Settings")').first().click();
  await expect(page.getByText("Calendar Sharing", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Cross-install sharing")).toBeVisible({ timeout: 15_000 });
});

test("vault settings surface exposes daily section and import actions when bridge is enabled", async ({ page }) => {
  await page.route(`${apiBase}/vault/status**`, (route) => route.fulfill(json({
    config: {
      vault_enabled: true,
      vault_path: "/Users/test/ObsidianVault",
      daily_note_folder: "Daily",
      tasks_folder: "Tasks",
      review_folder: "Review",
      projects_folder: "Projects",
      attachments_folder: "Attachments",
    },
    vault_reachable: true,
    total_indexed: 4,
    conflicts: 1,
    last_push_at: "2026-04-05T10:00:00",
    last_pull_at: "2026-04-05T09:00:00",
  })));
  await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([
    {
      id: 1,
      entity_type: "task",
      entity_id: "inbox",
      file_path: "Tasks/Inbox.md",
      file_hash: "abc",
      last_synced_at: "2026-04-05T10:00:00",
      last_direction: "push",
      sync_status: "conflict",
      created_at: "2026-04-05T08:00:00",
    },
  ])));

  await page.goto("/#/settings");
  await expect(page.getByText("Daily task section", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Import tasks from vault", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Scan" }).click();
  await expect(page.getByText("Import from vault")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Push section" }).click();
  await expect(page.getByText("Task section pushed to")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("task · inbox")).toBeVisible({ timeout: 15_000 });
});

test("tasks surface tolerates a task with missing title field", async ({ page }) => {
  // Return a task with `title` set to empty string — simulates a backend
  // payload shape mismatch that could happen if a migration or sync bug
  // produces records without a proper title.
  await page.route(`${apiBase}/tasks**`, async (route) => {
    const url = route.request().url();
    if (url.includes("/boards/")) {
      await route.fulfill(json([]));
      return;
    }
    await route.fulfill(json([
      {
        id: "tsk_broken",
        title: "",
        description: null,
        due_at: null,
        priority: 3,
        status: "todo",
        done: false,
        estimated_minutes: null,
        actual_minutes: null,
        recurrence_rule: null,
        recurrence_parent_id: null,
        sort_order: 0,
        subtasks: [],
        tags: [],
        source_type: null,
        source_external_id: null,
        project_id: null,
        created_at: "2026-04-01T07:00:00Z",
        updated_at: "2026-04-01T07:00:00Z",
      },
    ]));
  });

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await page.goto("/#/tasks");
  await expect(page.getByText("Task runway")).toBeVisible({ timeout: 15_000 });

  // The surface should still render even with a blank-title task.
  // No unhandled JS exceptions.
  expect(pageErrors).toHaveLength(0);
});

test("today surface tolerates a malformed notification payload", async ({ page }) => {
  // Return a notification with missing required fields
  await page.route(`${apiBase}/notifications**`, async (route) => {
    const url = route.request().url();
    if (url.includes("/unread-count")) {
      await route.fulfill(json({ count: 1 }));
      return;
    }
    await route.fulfill(json([
      {
        id: "ntf_broken",
        // missing: level, title, body
        read: false,
        archived: false,
        created_at: "2026-04-01T08:00:00Z",
        action_url: null,
      },
    ]));
  });

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await page.goto("/");
  await expect(page.getByTitle("Notifications")).toBeVisible({ timeout: 15_000 });

  // Surface renders without crashing despite malformed notification
  expect(pageErrors).toHaveLength(0);
});
