import { expect, test } from "@playwright/test";

const apiBase = "**/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Focus flow regression", () => {
  test.beforeEach(async ({ page }) => {
    // Stateful session store so start/complete mutations persist within a test
    let sessions: Array<{
      id: string;
      task_id: string | null;
      started_at: string;
      ended_at: string | null;
      duration_minutes: number;
      status: string;
    }> = [];

    await page.addInitScript(() => {
      window.localStorage.setItem("dopaflow_onboarded", "1");
      window.localStorage.setItem("zoestm_planned_date", new Date().toISOString().slice(0, 10));
    });

    await page.route(`${apiBase}/tasks**`, (route) =>
      route.fulfill(json([
        {
          id: "tsk_focus_target",
          title: "Write integration tests",
          description: null,
          due_at: null,
          priority: 1,
          status: "todo",
          done: false,
          estimated_minutes: 60,
          actual_minutes: null,
          recurrence_rule: null,
          recurrence_parent_id: null,
          sort_order: 0,
          subtasks: [],
          tags: [],
          source_type: null,
          source_external_id: null,
          project_id: null,
          created_at: "2026-04-04T07:00:00Z",
          updated_at: "2026-04-04T07:00:00Z",
        },
      ])),
    );

    // Focus session routes — stateful (use glob to catch trailing slash variants)
    await page.route(`${apiBase}/focus/sessions**`, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // GET /focus/sessions → list
      if (method === "GET" && !url.includes("/control")) {
        await route.fulfill(json(sessions));
        return;
      }
      // POST /focus/sessions → create new running session
      if (method === "POST" && !url.includes("/control")) {
        const payload = route.request().postDataJSON() as {
          task_id?: string;
          duration_minutes?: number;
          started_at?: string;
        };
        const newSession = {
          id: `fs_${sessions.length + 1}`,
          task_id: payload.task_id ?? null,
          started_at: payload.started_at ?? new Date().toISOString(),
          ended_at: null,
          duration_minutes: payload.duration_minutes ?? 25,
          status: "running",
        };
        sessions = [...sessions, newSession];
        await route.fulfill(json(newSession));
        return;
      }
      await route.fulfill(json({}));
    });

    await page.route(`${apiBase}/focus/sessions/control`, async (route) => {
      const payload = route.request().postDataJSON() as { action: string };
      const activeSession = sessions.find((s) => s.status === "running" || s.status === "paused");
      if (activeSession) {
        activeSession.status = payload.action;
        if (payload.action === "completed") {
          activeSession.ended_at = new Date().toISOString();
        }
      }
      await route.fulfill(json(activeSession ?? { ok: true }));
    });

    await page.route(`${apiBase}/focus/**`, async (route) => {
      const url = route.request().url();
      if (url.includes("/focus/sessions") || url.includes("/focus/status")) {
        await route.fallback();
        return;
      }
      await route.fulfill(json({}));
    });
    await page.route(`${apiBase}/focus/status**`, (route) =>
      route.fulfill(json({ status: sessions.some((s) => s.status === "running") ? "active" : "idle" })),
    );

    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
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
    await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
  });

  // ── Surface rendering ──────────────────────────────────────────────────────

  test("focus surface renders hero stats and focus panel", async ({ page }) => {
    await page.goto("/#/focus");
    const main = page.getByRole("main");
    await expect(main.getByText("Focus Block", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText("Today", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText("completed focus time")).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText("Sessions", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText("blocks finished today")).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText("Target", { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  // ── Task selection + start session ─────────────────────────────────────────

  test("can select a task and start a focus session", async ({ page }) => {
    await page.goto("/#/focus");
    const main = page.getByRole("main");
    await expect(main.getByText("Focus Block", { exact: true })).toBeVisible({ timeout: 15_000 });

    // The seed task should appear in the task picker dropdown
    // First verify the task exists in tasks (task picker button should show it)
    // The FocusPanel shows "Choose a task…" when no task selected
    await expect(page.getByRole("button", { name: "Link session to a task" })).toContainText("Choose a task", { timeout: 15_000 });

    // Open the task picker
    await page.getByRole("button", { name: "Link session to a task" }).click();
    // Select the task from the dropdown
    await page.getByRole("button", { name: "Write integration tests" }).click();

    // Now the task picker should show the selected task
    await expect(page.getByRole("button", { name: "Link session to a task" })).toContainText("Write integration tests", { timeout: 5_000 });
    // And the Target card should reflect it
    await expect(page.getByText("ready for the next block")).toBeVisible({ timeout: 5_000 });

    // Click 25m preset (should be the default)
    await page.getByRole("button", { name: "25m" }).click();

    // Start the session
    await page.getByRole("button", { name: "Start Focus" }).click();

    // The hero section should now show "In session" eyebrow
    await expect(main.getByText("In session", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText("Protect Write integration tests", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Active timer", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("timer")).toContainText(/\d{2}:\d{2}/, { timeout: 5_000 });
  });

  // ── Session history ────────────────────────────────────────────────────────

  test("session history panel renders on the focus surface", async ({ page }) => {
    await page.goto("/#/focus");
    await expect(page.getByText("Session History")).toBeVisible({ timeout: 15_000 });
  });

  // ── Empty state messaging ──────────────────────────────────────────────────

  test("focus surface shows setup guidance when no session is active", async ({ page }) => {
    await page.goto("/#/focus");
    // Before any session, the hero should show setup guidance
    await expect(page.getByText("Choose one task before you start the timer")).toBeVisible({ timeout: 15_000 });
  });
});
