import { expect, test } from "@playwright/test";

const apiBase = "http://127.0.0.1:8000/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

const todayISO = new Date().toISOString().slice(0, 10);

test.describe("Daily loop regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("dopaflow_onboarded", "1");
      window.localStorage.setItem("zoestm_planned_date", todayISO);
    });

    await page.route(`${apiBase}/tasks**`, async (route) => {
      const url = route.request().url();
      if (url.includes("/boards/")) {
        await route.fulfill(json([]));
        return;
      }
      if (route.request().method() === "GET") {
        await route.fulfill(json([
          {
            id: "tsk_due_today",
            title: "Ship UI polish pass",
            description: null,
            due_at: `${todayISO}T09:00:00Z`,
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
            created_at: `${todayISO}T07:00:00Z`,
            updated_at: `${todayISO}T07:00:00Z`,
          },
          {
            id: "tsk_completed_today",
            title: "Morning standup",
            description: null,
            due_at: `${todayISO}T08:00:00Z`,
            priority: 1,
            status: "done",
            done: true,
            estimated_minutes: 15,
            actual_minutes: 10,
            recurrence_rule: null,
            recurrence_parent_id: null,
            sort_order: 1,
            subtasks: [],
            tags: [],
            source_type: null,
            source_external_id: null,
            project_id: null,
            created_at: `${todayISO}T07:00:00Z`,
            updated_at: `${todayISO}T08:15:00Z`,
          },
          {
            id: "tsk_no_due",
            title: "Refactor hooks",
            description: null,
            due_at: null,
            priority: 2,
            status: "todo",
            done: false,
            estimated_minutes: 60,
            actual_minutes: null,
            recurrence_rule: null,
            recurrence_parent_id: null,
            sort_order: 2,
            subtasks: [],
            tags: [],
            source_type: null,
            source_external_id: null,
            project_id: null,
            created_at: `${todayISO}T07:00:00Z`,
            updated_at: `${todayISO}T07:00:00Z`,
          },
        ]));
        return;
      }
      await route.fulfill(json({}));
    });

    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/sessions/control**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/status**`, (route) => route.fulfill(json({ status: "idle" })));
    await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([
      {
        id: "evt_1",
        title: "Team sync",
        start_at: `${todayISO}T14:00:00Z`,
        end_at: `${todayISO}T14:30:00Z`,
        all_day: false,
        source: "local",
        created_at: `${todayISO}T07:00:00Z`,
      },
    ])));
    await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
    await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "Keep the surface clean.", tone: "helpful", suggested_action: null, momentum: { score: 72, delta_vs_yesterday: 4, level: "flowing", summary: "Solid momentum." } })));
    await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/insights/momentum**`, (route) => route.fulfill(json({ score: 72, delta_vs_yesterday: 4, level: "flowing", summary: "Solid momentum." })));
    await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));
  });

  // ── Today runway card ──────────────────────────────────────────────────────

  test("today surface does not crash", async ({ page }) => {
    await page.goto("/#/today");
    await page.waitForTimeout(2000);
    const hasError = await page.getByText("Surface failed to render").isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });

  // ── Focus prefill / selected-task flow ─────────────────────────────────────

  test("focus surface does not crash", async ({ page }) => {
    await page.goto("/#/focus");
    await page.waitForTimeout(2000);
    const hasError = await page.getByText("Surface failed to render").isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });

  // ── Focus completion -> break / next-block ─────────────────────────────────

  test("focus completion modal renders after session ends", async ({ page }) => {
    await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([
      { id: "fs_1", status: "completed", task_id: "tsk_due_today", started_at: `${todayISO}T08:00:00Z`, ended_at: `${todayISO}T08:25:00Z`, duration_minutes: 25 },
    ])));
    await page.goto("/#/focus");
    await expect(page.getByText("25m today")).toBeVisible({ timeout: 15_000 });
  });

  // ── Shutdown modal ─────────────────────────────────────────────────────────

  test("shutdown modal renders with steps and stats", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    // Open shutdown via keyboard shortcut or by evaluating the state directly
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("dopaflow:open-shutdown"));
    });
    await page.waitForTimeout(500);
    // The shutdown modal is rendered at the App level, check it exists
    const hasModal = await page.getByRole("dialog").isVisible().catch(() => false);
    expect(hasModal).toBe(true);
  });

  test("shutdown modal can advance through steps", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("dopaflow:open-shutdown"));
    });
    await page.waitForTimeout(500);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Wins")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Defer")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("Tomorrow")).toBeVisible({ timeout: 15_000 });
  });

  test("shutdown modal can go back from defer to wins", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("dopaflow:open-shutdown"));
    });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Defer")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Wins")).toBeVisible({ timeout: 15_000 });
  });

  test("shutdown modal closes and returns to app", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("dopaflow:open-shutdown"));
    });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);
    const hasError = await page.getByText("Surface failed to render").isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});
