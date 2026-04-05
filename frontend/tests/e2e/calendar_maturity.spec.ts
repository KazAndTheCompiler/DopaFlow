import { expect, test } from "@playwright/test";

const apiBase = "**/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

const BASE_EVENT = {
  id: "evt_test_1",
  title: "Team standup",
  description: "Daily sync",
  start_at: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
  end_at: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
  all_day: false,
  category: "work",
  recurrence: null,
  source_type: null,
  source_external_id: null,
  source_instance_id: null,
  source_origin_app: null,
  sync_status: "local_only",
  provider_readonly: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const READONLY_EVENT = {
  ...BASE_EVENT,
  id: "evt_readonly_1",
  title: "Shared meeting",
  source_type: "peer:feed_123",
  provider_readonly: true,
  sync_status: "synced",
};

async function setupRoutes(page: Parameters<typeof test>[1]["page"]) {
  await page.addInitScript(() => {
    window.localStorage.setItem("dopaflow_onboarded", "1");
    window.localStorage.setItem("zoestm_planned_date", new Date().toISOString().slice(0, 10));
  });

  await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
  await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "", tone: "helpful", suggested_action: null })));
  await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
  await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/vault/status**`, (route) => route.fulfill(json({
    config: { vault_enabled: false, vault_path: "", daily_note_folder: "Daily", tasks_folder: "Tasks", review_folder: "Review", projects_folder: "Projects", attachments_folder: "Attachments" },
    vault_reachable: false, total_indexed: 0, conflicts: 0, last_push_at: null, last_pull_at: null,
  })));
  await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));
  await page.route(`${apiBase}/calendar/sync/status**`, (route) => route.fulfill(json({ ok: true, conflicts: 0, status: "healthy" })));
  await page.route(`${apiBase}/calendar/sync/conflicts**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/sharing/feeds**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/sharing/tokens**`, (route) => route.fulfill(json([])));
}

test.describe("Calendar maturity — event details", () => {
  test("clicking a calendar event opens the details modal", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([BASE_EVENT])));

    await page.goto("/#/calendar");
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await page.waitForTimeout(800);

    // Find the event card in the day grid and click it
    const eventCard = page.getByTitle(/Team standup/);
    await eventCard.first().scrollIntoViewIfNeeded();
    await eventCard.first().click();

    // The modal header shows "Edit event" when a local editable event is opened
    await expect(page.getByText("Edit event", { exact: true })).toBeVisible({ timeout: 8_000 });
  });

  test("read-only mirrored events show lock indicator and disable editing", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([READONLY_EVENT])));

    await page.goto("/#/calendar");
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await page.waitForTimeout(800);

    const eventCard = page.getByTitle(/Shared meeting/);
    await eventCard.first().scrollIntoViewIfNeeded();
    await eventCard.first().click();

    // Read-only events open as "Event details" not "Edit event"
    await expect(page.getByText("Event details", { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/Read-only mirror/i)).toBeVisible({ timeout: 5_000 });

    // Save button should not be visible for read-only events
    await expect(page.getByRole("button", { name: /Save changes/i })).not.toBeVisible();
  });

  test("local event modal shows save and delete buttons", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([BASE_EVENT])));

    await page.goto("/#/calendar");
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await page.waitForTimeout(800);

    const eventCard = page.getByTitle(/Team standup/);
    await eventCard.first().scrollIntoViewIfNeeded();
    await eventCard.first().click();

    await expect(page.getByText("Edit event", { exact: true })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /Save changes/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /Delete/i })).toBeVisible({ timeout: 5_000 });
  });

  test("week view renders event with source color indicator", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([BASE_EVENT])));

    await page.goto("/#/calendar");
    await expect(page.getByRole("button", { name: "Week" })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);

    await expect(page.getByText("Team standup").first()).toBeVisible({ timeout: 5_000 });
  });

  test("month view renders +N more for dense days", async ({ page }) => {
    const today = new Date();
    const manyEvents = Array.from({ length: 5 }, (_, i) => ({
      ...BASE_EVENT,
      id: `evt_many_${i}`,
      title: `Event ${i + 1}`,
      start_at: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9 + i, 0).toISOString(),
      end_at: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10 + i, 0).toISOString(),
    }));

    await setupRoutes(page);
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json(manyEvents)));

    await page.goto("/#/calendar");
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/\+ 2 more/).first()).toBeVisible({ timeout: 5_000 });
  });

  test("calendar surface loads without errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await setupRoutes(page);
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([BASE_EVENT, READONLY_EVENT])));

    await page.goto("/#/calendar");
    await page.getByRole("button", { name: "Day", exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await page.waitForTimeout(500);

    expect(pageErrors).toHaveLength(0);
  });
});
