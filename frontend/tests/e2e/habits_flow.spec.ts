import { expect, test } from "@playwright/test";

const apiBase = "http://127.0.0.1:8000/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Habits flow regression", () => {
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
  });

  test("habits surface does not crash", async ({ page }) => {
    await page.goto("/#/habits");
    await page.waitForTimeout(2000);
    const hasError = await page.getByText("Surface failed to render").isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});
