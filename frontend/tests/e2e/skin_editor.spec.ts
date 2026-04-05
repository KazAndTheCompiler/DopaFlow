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

  await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/focus/status**`, (route) => route.fulfill(json({ status: "idle" })));
  await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/events**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/sync/conflicts**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/calendar/sync/status**`, (route) => route.fulfill(json({ ok: true, conflicts: 0, status: "healthy" })));
  await page.route(`${apiBase}/calendar/sharing/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/notifications/unread-count**`, (route) => route.fulfill(json({ count: 0 })));
  await page.route(`${apiBase}/packy/**`, (route) => route.fulfill(json({ text: "Keep the surface clean.", tone: "helpful", suggested_action: null })));
  await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/commands/**`, (route) => route.fulfill(json({ action: "open-today" })));
  await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
  await page.route(`${apiBase}/vault/**`, (route) => route.fulfill(json({ config: { vault_enabled: false }, vault_reachable: false })));
  await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));
});

test("skin editor loads and displays themes", async ({ page }) => {
  await page.goto("/#/settings");

  await expect(page.getByText("Look & Feel")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Theme", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Ink & Stone").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Light")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Dark")).toBeVisible({ timeout: 15_000 });
});

test("skin editor allows preview and apply flow", async ({ page }) => {
  await page.goto("/#/settings");

  await expect(page.getByText("Currently active")).toBeVisible({ timeout: 15_000 });

  await page.locator("button:has-text('Midnight Neon')").first().click();

  await expect(page.getByText("Previewing (not applied yet)")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByText("Currently active")).toBeVisible({ timeout: 15_000 });
});

test("skin editor reset to default works", async ({ page }) => {
  await page.goto("/#/settings");

  await page.locator("button:has-text('Midnight Neon')").first().click();
  await page.getByRole("button", { name: "Apply" }).click();

  await page.getByRole("button", { name: "Reset to default" }).click();

  await expect(page.getByText("Currently active")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Ink & Stone").first()).toBeVisible({ timeout: 15_000 });
});

test("skin editor export button exists", async ({ page }) => {
  await page.goto("/#/settings");

  await expect(page.getByRole("button", { name: "Export" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Import", exact: true })).toBeVisible({ timeout: 15_000 });
});
