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
  const today = new Date();
  const start = new Date(today);
  start.setHours(10, 0, 0, 0);
  const end = new Date(today);
  end.setHours(11, 0, 0, 0);
  let calendarEvents = [
    {
      id: "evt_1",
      title: "Design review",
      description: "Tighten the premium planning pass",
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: false,
      category: "work",
      recurrence: null,
      source_type: null,
      source_external_id: null,
      source_instance_id: null,
      source_origin_app: "dopaflow",
      sync_status: "local_only",
      provider_readonly: false,
      created_at: start.toISOString(),
      updated_at: start.toISOString(),
    },
  ];

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
  await page.route(`${apiBase}/goals**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/focus/sessions/control**`, (route) => route.fulfill(json({ id: "fs_1", status: "completed", task_id: null, started_at: "2026-04-01T08:00:00Z", ended_at: "2026-04-01T08:25:00Z", duration_minutes: 25 })));
  await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/status**`, (route) => route.fulfill(json({ status: "idle" })));
  await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/events**`, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === "GET") {
      await route.fulfill(json(calendarEvents));
      return;
    }
    if (method === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      const created = {
        id: `evt_${calendarEvents.length + 1}`,
        description: null,
        category: "work",
        recurrence: null,
        source_type: null,
        source_external_id: null,
        source_instance_id: null,
        source_origin_app: "dopaflow",
        sync_status: "local_only",
        provider_readonly: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...body,
      };
      calendarEvents = [...calendarEvents, created];
      await route.fulfill(json(created));
      return;
    }
    if (method === "PATCH") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      const eventId = url.split("/calendar/events/")[1]?.split("?")[0];
      const existing = calendarEvents.find((event) => event.id === eventId);
      const updated = {
        ...existing,
        ...body,
        updated_at: new Date().toISOString(),
      };
      calendarEvents = calendarEvents.map((event) => (event.id === eventId ? updated : event));
      await route.fulfill(json(updated));
      return;
    }
    if (method === "DELETE") {
      const eventId = url.split("/calendar/events/")[1]?.split("?")[0];
      calendarEvents = calendarEvents.filter((event) => event.id !== eventId);
      await route.fulfill(json({ deleted: true }));
      return;
    }
    await route.fulfill(json(calendarEvents));
  });
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
    {
      id: "ntf_2",
      level: "system",
      title: "Review queue refreshed",
      body: "New cards are ready for your next session.",
      read: true,
      archived: false,
      created_at: "2026-04-01T07:15:00Z",
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
      total_xp: 40,
      level: 1,
      xp_to_next: 60,
      progress: 0.4,
      updated_at: "2026-04-01T08:00:00Z",
    },
    badges: [],
    earned_count: 0,
  })));
  await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({
    score: 78,
    momentum_label: "flowing",
    date: "2026-04-05",
    week_start: "2026-03-30",
    week_end: "2026-04-05",
    tasks: { completed: 4 },
    habits: { by_habit: [{ count: 2 }, { count: 1 }], best_habit: "Hydration" },
    focus: { total_sessions: 2, total_minutes: 55 },
    journal: { entries_written: 1 },
    nutrition: { total_kcal: 1850, avg_kcal: 1920, days_logged: 1, protein_g: 110 },
  })));
  await page.route(`${apiBase}/nutrition/**`, (route) => {
    if (route.request().url().includes("/nutrition/foods")) {
      return route.fulfill(json([
        {
          id: "preset_coffee_cup",
          name: "Coffee",
          kj: 8,
          unit: "cup",
          protein_g: 0.3,
          carbs_g: 0,
          fat_g: 0,
          meal_label: "breakfast",
          is_preset: true,
        },
        {
          id: "preset_basic_sandwich",
          name: "Basic sandwich",
          kj: 1150,
          unit: "sandwich",
          protein_g: 15.5,
          carbs_g: 28,
          fat_g: 12.6,
          meal_label: "lunch",
          is_preset: true,
        },
      ]));
    }
    return route.fulfill(json([]));
  });
  await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/player/queue**`, (route) => route.fulfill(json({ items: [] })));
  await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
  await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/integrations/status**`, (route) => route.fulfill(json({
    gmail_status: "connected",
    gmail_connected: true,
    webhooks_enabled: true,
    webhook_pending: 2,
    webhook_retry_wait: 1,
    webhook_sent: 4,
  })));
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
  await page.route(`${apiBase}/vault/conflicts/*/preview`, (route) => route.fulfill(json({
    record: {
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
    snapshot_body: "## Inbox\\n\\n- [ ] App snapshot",
    current_body: "## Inbox\\n\\n- [ ] Vault edited",
    current_exists: true,
  })));
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

  await expect(page.getByRole("button", { name: /open notifications/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("LV 1 · 60 XP to next")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /open notifications/i }).click();
  await expect(page.getByText("Inbox", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Needs attention")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Recently cleared")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Shared calendar synced")).toBeVisible({ timeout: 15_000 });
});

test("digest surface explains momentum instead of only showing raw counters", async ({ page }) => {
  await page.goto("/");

  await page.locator('nav button:has-text("Digest")').first().click();

  await expect(page.getByText("You kept momentum moving in the right direction.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("What this period says")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Execution is visible with 4 completed tasks.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("What to reinforce")).toBeVisible({ timeout: 15_000 });
});

test("calendar and settings surfaces render updated UI", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('nav button:has-text("Calendar")').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('nav button:has-text("Calendar")').first().click();
  await expect(page.getByText("Planning surface")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Design review")).toBeVisible({ timeout: 15_000 });
  await page.getByText("Design review").first().click();
  await expect(page.getByText("Edit event")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Event title").fill("Design review polished");
  await page.getByLabel("Event recurrence").selectOption("FREQ=WEEKLY");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Calendar event updated.")).toBeVisible({ timeout: 15_000 });

  await page.locator('nav button:has-text("Settings")').first().click();
  await expect(page.getByText("Integrations overview")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Google Calendar")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Needs Attention", { exact: true })).toBeVisible({ timeout: 15_000 });
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
  await page.route(`${apiBase}/vault/conflicts**`, (route) => {
    if (route.request().url().includes("/preview")) {
      return route.fulfill(json({
        record: {
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
        snapshot_body: "## Inbox\\n\\n- [ ] App snapshot",
        current_body: "## Inbox\\n\\n- [ ] Vault edited",
        current_exists: true,
        diff_lines: [
          "--- dopaflow_snapshot",
          "+++ vault_current",
          "@@ -1,3 +1,3 @@",
          " ## Inbox",
          "",
          "- [ ] App snapshot",
          "+ [ ] Vault edited",
        ],
      }));
    }
    return route.fulfill(json([
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
    ]));
  });

  await page.goto("/#/settings");
  await expect(page.getByText("Daily task section", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Import tasks from vault", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Scan" }).click();
  await expect(page.getByText("Import from vault")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Push section" }).click();
  await expect(page.getByText("Task section pushed to")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("task · inbox")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.getByText("Diff summary")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Current vault")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("+ [ ] Vault edited", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("- [ ] App snapshot", { exact: true })).toBeVisible({ timeout: 15_000 });
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
  await expect(page.getByPlaceholder("Quick add — type or speak")).toBeVisible({ timeout: 15_000 });

  // The surface should still render even with a blank-title task.
  // No unhandled JS exceptions.
  expect(pageErrors).toHaveLength(0);
});

test("nutrition surface exposes starter preset foods", async ({ page }) => {
  await page.goto("/#/nutrition");

  await expect(page.getByText("Starter food library")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Coffee")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Basic sandwich")).toBeVisible({ timeout: 15_000 });
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
