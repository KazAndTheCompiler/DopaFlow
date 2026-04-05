import { expect, test } from "@playwright/test";

const apiBase = "**/api/v2";

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

const TODAY_DUE_CARD = {
  id: "card_test_1",
  deck_id: "deck_default",
  front: "What is spaced repetition?",
  back: "A learning technique that uses increasing intervals between reviews.",
  interval: 0,
  ease_factor: 2.5,
  next_review_at: null,
  last_rating: null,
  lapse_count: 0,
  reviews_done: 0,
};

const REVIEWED_CARD = {
  ...TODAY_DUE_CARD,
  id: "card_reviewed_1",
  interval: 6,
  ease_factor: 2.5,
  next_review_at: new Date(Date.now() + 6 * 86_400_000).toISOString(),
  reviews_done: 2,
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
    config: { vault_enabled: false, vault_path: "", daily_note_folder: "Daily", tasks_folder: "Tasks", review_folder: "Review", projects_folder: "Projects", attachments_folder: "Attachments" },
    vault_reachable: false, total_indexed: 0, conflicts: 0, last_push_at: null, last_pull_at: null,
  })));
  await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([])));
  await page.route(`${apiBase}/motivation/**`, (route) => route.fulfill(json({ quote: "Stay sharp." })));
}

test.describe("Review premium — card interaction", () => {
  test("review surface renders due card", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/review/cards**`, (route) => route.fulfill(json([TODAY_DUE_CARD])));
    await page.route(`${apiBase}/review/decks**`, (route) => route.fulfill(json([{ id: "deck_default", name: "Default", card_count: 1 }])));

    await page.goto("/#/review");
    await page.waitForTimeout(500);

    await expect(page.getByText("What is spaced repetition?").first()).toBeVisible({ timeout: 8_000 });
  });

  test("Show Answer button reveals back of card", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/review/cards**`, (route) => route.fulfill(json([TODAY_DUE_CARD])));
    await page.route(`${apiBase}/review/decks**`, (route) => route.fulfill(json([{ id: "deck_default", name: "Default", card_count: 1 }])));

    await page.goto("/#/review");
    await page.waitForTimeout(500);

    await expect(page.getByText("What is spaced repetition?").first()).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: /Show Answer/i }).click();

    await expect(page.getByText("A learning technique that uses increasing intervals between reviews.")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Good" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Easy" })).toBeVisible();
  });

  test("keyboard shortcut Space flips the card", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/review/cards**`, (route) => route.fulfill(json([TODAY_DUE_CARD])));
    await page.route(`${apiBase}/review/decks**`, (route) => route.fulfill(json([{ id: "deck_default", name: "Default", card_count: 1 }])));

    await page.goto("/#/review");
    await page.waitForTimeout(500);

    await expect(page.getByText("What is spaced repetition?").first()).toBeVisible({ timeout: 8_000 });

    // Press Space to flip
    await page.keyboard.press("Space");

    await expect(page.getByText("A learning technique that uses increasing intervals between reviews.")).toBeVisible({ timeout: 5_000 });
  });

  test("empty deck shows no-cards-due message", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/review/cards**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/review/decks**`, (route) => route.fulfill(json([{ id: "deck_default", name: "Default", card_count: 0 }])));

    await page.goto("/#/review");
    await page.waitForTimeout(500);

    await expect(page.getByText("No cards due.", { exact: false })).toBeVisible({ timeout: 8_000 });
  });

  test("edit card button opens the edit modal", async ({ page }) => {
    await setupRoutes(page);
    await page.route(`${apiBase}/review/cards**`, (route) => route.fulfill(json([TODAY_DUE_CARD])));
    await page.route(`${apiBase}/review/decks**`, (route) => route.fulfill(json([{ id: "deck_default", name: "Default", card_count: 1 }])));

    await page.goto("/#/review");
    await page.waitForTimeout(500);

    await expect(page.getByText("What is spaced repetition?").first()).toBeVisible({ timeout: 8_000 });

    // Edit button on the card face
    await page.getByRole("button", { name: "Edit" }).first().click();

    await expect(page.getByText("Edit card", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("textbox", { name: "Card front" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("textbox", { name: "Card back" })).toBeVisible({ timeout: 5_000 });
  });

  test("review surface loads without errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await setupRoutes(page);
    await page.route(`${apiBase}/review/cards**`, (route) => route.fulfill(json([TODAY_DUE_CARD, REVIEWED_CARD])));
    await page.route(`${apiBase}/review/decks**`, (route) => route.fulfill(json([{ id: "deck_default", name: "Default", card_count: 2 }])));

    await page.goto("/#/review");
    await page.waitForTimeout(1000);

    expect(pageErrors).toHaveLength(0);
  });
});
