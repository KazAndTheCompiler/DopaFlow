import { expect, test } from "@playwright/test";

const apiBase = "**/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Goals flow regression", () => {
  test.beforeEach(async ({ page }) => {
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
    let goals: Array<{
      id: string;
      title: string;
      description?: string;
      horizon: "week" | "month" | "quarter" | "year";
      milestones: Array<{ id: string; label: string; done: boolean }>;
      created_at: string;
      updated_at?: string;
      done: boolean;
    }> = [];

    await page.route(`${apiBase}/goals**`, async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill(json(goals));
        return;
      }

      if (method === "POST") {
        const payload = route.request().postDataJSON() as {
          title: string;
          description?: string;
          horizon: "week" | "month" | "quarter" | "year";
          milestone_labels?: string[];
        };
        const created = {
          id: `goal_${goals.length + 1}`,
          title: payload.title,
          description: payload.description,
          horizon: payload.horizon,
          milestones: (payload.milestone_labels ?? []).map((label, index) => ({
            id: `ms_${index + 1}`,
            label,
            done: false,
          })),
          created_at: "2026-04-04T09:00:00Z",
          updated_at: "2026-04-04T09:00:00Z",
          done: false,
        };
        goals = [...goals, created];
        await route.fulfill(json(created));
        return;
      }

      await route.fulfill(json({ ok: true }));
    });
  });

  test("goals surface shows the empty state before anything is created", async ({ page }) => {
    await page.goto("/#/goals");
    await expect(page.getByText("No goals yet")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Set a long-term goal and break it into milestones to track progress."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("goals surface renders create form", async ({ page }) => {
    await page.goto("/#/goals");
    await expect(page.getByText("New goal")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder("e.g. Launch side project")).toBeVisible({ timeout: 15_000 });
  });

  test("goals surface can create a goal with milestones", async ({ page }) => {
    await page.goto("/#/goals");

    await page.getByPlaceholder("e.g. Launch side project").fill("Launch side project");
    await page.getByPlaceholder("What does success look like?").fill("Ship a useful first version.");
    await page.getByPlaceholder("Research\nBuild MVP\nLaunch").fill("Research\nBuild MVP\nLaunch");
    await page.getByRole("button", { name: "+ Create goal" }).click();

    await expect(page.getByText("Launch side project")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Ship a useful first version.")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "▸ Details" }).click();
    await expect(page.getByText("Research")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Build MVP")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Launch", { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
