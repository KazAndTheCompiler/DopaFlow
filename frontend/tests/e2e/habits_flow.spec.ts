import { expect, test } from '@playwright/test';

const apiBase = '**/api/v2';

function json(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

test.describe('Habits flow regression', () => {
  test.beforeEach(async ({ page }) => {
    // Stateful habits store so POST mutations persist within a test
    let habits: Array<{
      id: string;
      name: string;
      target_freq: number;
      target_period: string;
      current_streak: number;
      best_streak: number;
      completion_pct: number;
      freeze_until: string | null;
      color: string;
      last_checkin_date: string | null;
      created_at: string;
      updated_at: string;
    }> = [];

    await page.addInitScript(() => {
      window.localStorage.setItem('dopaflow:onboarded', '1');
      window.localStorage.setItem('dopaflow:planned_date', new Date().toISOString().slice(0, 10));
    });

    // All habits routes in one handler to avoid glob-matching conflicts
    await page.route(`${apiBase}/habits**`, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // GET /habits/ or /habits → return the list
      if (
        method === 'GET' &&
        (url.endsWith('/habits/') ||
          url.endsWith('/habits') ||
          (url.includes('/habits/') &&
            !url.includes('/logs') &&
            !url.includes('/checkin') &&
            !url.includes('/freeze') &&
            !url.includes('/unfreeze')))
      ) {
        await route.fulfill(json(habits));
        return;
      }

      // GET /habits/{id}/logs
      if (method === 'GET' && url.includes('/logs')) {
        await route.fulfill(json([]));
        return;
      }

      // POST /habits/ → create
      if (method === 'POST' && (url.endsWith('/habits/') || url.endsWith('/habits'))) {
        const payload = route.request().postDataJSON() as {
          name: string;
          target_freq: number;
          target_period: string;
        };
        const created = {
          id: `habit_${habits.length + 1}`,
          name: payload.name,
          target_freq: payload.target_freq,
          target_period: payload.target_period,
          current_streak: 0,
          best_streak: 0,
          completion_pct: 0,
          freeze_until: null,
          color: 'var(--accent)',
          last_checkin_date: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        habits = [...habits, created];
        await route.fulfill(json(created));
        return;
      }

      // POST /habits/{id}/checkin
      if (method === 'POST' && url.includes('/checkin')) {
        const idMatch = url.match(/habits\/([^/]+)\/checkin/);
        const id = idMatch?.[1];
        habits = habits.map((h) =>
          h.id === id
            ? {
                ...h,
                current_streak: h.current_streak + 1,
                completion_pct: 100,
                last_checkin_date: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : h,
        );
        const updated = habits.find((h) => h.id === id) ?? habits[0];
        await route.fulfill(json(updated));
        return;
      }

      // PATCH freeze/unfreeze
      if (method === 'PATCH') {
        await route.fulfill(json(habits[0] ?? { ok: true }));
        return;
      }

      await route.fulfill(json({}));
    });

    await page.route(`${apiBase}/tasks**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications/unread-count**`, (route) =>
      route.fulfill(json({ count: 0 })),
    );
    await page.route(`${apiBase}/packy/**`, (route) =>
      route.fulfill(json({ text: '', tone: 'helpful', suggested_action: null })),
    );
    await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/insights/correlations**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/commands/**`, (route) =>
      route.fulfill(json({ action: 'open-today' })),
    );
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/vault/status**`, (route) =>
      route.fulfill(
        json({
          config: {
            vault_enabled: false,
            vault_path: '',
            daily_note_folder: 'Daily',
            tasks_folder: 'Tasks',
            review_folder: 'Review',
            projects_folder: 'Projects',
            attachments_folder: 'Attachments',
          },
          vault_reachable: false,
          total_indexed: 0,
          conflicts: 0,
          last_push_at: null,
          last_pull_at: null,
        }),
      ),
    );
    await page.route(`${apiBase}/vault/conflicts**`, (route) => route.fulfill(json([])));
  });

  // ── Create + check-in flow ─────────────────────────────────────────────────

  test('can create a habit and check it in', async ({ page }) => {
    await page.goto('/#/habits');

    // Create form renders
    await expect(page.getByText('Habit name')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('e.g. Morning workout')).toBeVisible({ timeout: 15_000 });

    // Fill and submit
    await page.getByPlaceholder('e.g. Morning workout').fill('Morning meditation');
    await page.getByRole('button', { name: '+ Add habit' }).click();

    // Card appears with name, compact streak/frequency badges, and check-in button
    const habitCard = page.getByRole('article').filter({ hasText: 'Morning meditation' }).first();
    await expect(habitCard).toBeVisible({ timeout: 15_000 });
    await expect(habitCard.getByText('ST 0d', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(habitCard.getByText('1/ day', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(
      habitCard.getByRole('button', { name: 'Check in Morning meditation' }),
    ).toBeVisible({ timeout: 5_000 });

    // Check in
    await habitCard.getByRole('button', { name: 'Check in Morning meditation' }).click();
    // After check-in the app refreshes — streak should now be 1
    await expect(
      page
        .getByRole('article')
        .filter({ hasText: 'Morning meditation' })
        .first()
        .getByText('ST 1d', { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  test('habits surface shows empty state when no habits exist', async ({ page }) => {
    await page.goto('/#/habits');
    await expect(page.getByText('No habits yet')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Build consistency')).toBeVisible({ timeout: 5_000 });
  });

  // ── Correlation chart ──────────────────────────────────────────────────────

  test('correlation chart shows empty message with no data', async ({ page }) => {
    await page.goto('/#/habits');
    await expect(page.getByText('Pearson correlations')).toBeVisible({ timeout: 15_000 });
  });
});
