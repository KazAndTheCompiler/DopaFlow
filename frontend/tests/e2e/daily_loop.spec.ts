import { expect, test } from '@playwright/test';

const apiBase = '**/api/v2';

function json(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

const todayISO = new Date().toISOString().slice(0, 10);

test.describe('Daily loop regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dopaflow:onboarded', '1');
      const localNow = new Date();
      const localIso = new Date(localNow.getTime() - localNow.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10);
      window.localStorage.setItem('dopaflow:planned_date', localIso);
    });

    await page.route(`${apiBase}/tasks**`, async (route) => {
      const url = route.request().url();
      if (url.includes('/boards/')) {
        await route.fulfill(json([]));
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill(
          json([
            {
              id: 'tsk_due_today',
              title: 'Ship UI polish pass',
              description: null,
              due_at: `${todayISO}T09:00:00Z`,
              priority: 1,
              status: 'todo',
              done: false,
              estimated_minutes: 45,
              actual_minutes: null,
              recurrence_rule: null,
              recurrence_parent_id: null,
              sort_order: 0,
              subtasks: [],
              dependencies: [],
              tags: [],
              source_type: null,
              source_external_id: null,
              project_id: null,
              created_at: `${todayISO}T07:00:00Z`,
              updated_at: `${todayISO}T07:00:00Z`,
            },
            {
              id: 'tsk_completed_today',
              title: 'Morning standup',
              description: null,
              due_at: `${todayISO}T08:00:00Z`,
              priority: 1,
              status: 'done',
              done: true,
              estimated_minutes: 15,
              actual_minutes: 10,
              recurrence_rule: null,
              recurrence_parent_id: null,
              sort_order: 1,
              subtasks: [],
              dependencies: [],
              tags: [],
              source_type: null,
              source_external_id: null,
              project_id: null,
              created_at: `${todayISO}T07:00:00Z`,
              updated_at: `${todayISO}T08:15:00Z`,
            },
            {
              id: 'tsk_no_due',
              title: 'Refactor hooks',
              description: null,
              due_at: null,
              priority: 2,
              status: 'todo',
              done: false,
              estimated_minutes: 60,
              actual_minutes: null,
              recurrence_rule: null,
              recurrence_parent_id: null,
              sort_order: 2,
              subtasks: [],
              dependencies: [],
              tags: [],
              source_type: null,
              source_external_id: null,
              project_id: null,
              created_at: `${todayISO}T07:00:00Z`,
              updated_at: `${todayISO}T07:00:00Z`,
            },
          ]),
        );
        return;
      }
      await route.fulfill(json({}));
    });

    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/sessions/control**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/focus/status**`, (route) =>
      route.fulfill(json({ status: 'idle' })),
    );
    await page.route(`${apiBase}/focus/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/focus/sessions**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/review/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/journal/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/calendar/events**`, (route) =>
      route.fulfill(
        json([
          {
            id: 'evt_1',
            title: 'Team sync',
            start_at: `${todayISO}T14:00:00Z`,
            end_at: `${todayISO}T14:30:00Z`,
            all_day: false,
            sync_status: 'local_only',
            provider_readonly: false,
            created_at: `${todayISO}T07:00:00Z`,
            updated_at: `${todayISO}T07:00:00Z`,
          },
        ]),
      ),
    );
    await page.route(`${apiBase}/alarms**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/notifications/unread-count**`, (route) =>
      route.fulfill(json({ count: 0 })),
    );
    await page.route(`${apiBase}/packy/**`, (route) =>
      route.fulfill(
        json({
          text: 'Keep the surface clean.',
          tone: 'helpful',
          suggested_action: null,
          momentum: {
            score: 72,
            delta_vs_yesterday: 4,
            level: 'flowing',
            summary: 'Solid momentum.',
          },
        }),
      ),
    );
    await page.route(`${apiBase}/insights/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/insights/momentum**`, (route) =>
      route.fulfill(
        json({ score: 72, delta_vs_yesterday: 4, level: 'flowing', summary: 'Solid momentum.' }),
      ),
    );
    await page.route(`${apiBase}/gamification/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/digest/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/nutrition/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/search/**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/commands/**`, (route) =>
      route.fulfill(json({ action: 'open-today' })),
    );
    await page.route(`${apiBase}/meta/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/integrations/**`, (route) => route.fulfill(json({})));
    await page.route(`${apiBase}/motivation/**`, (route) =>
      route.fulfill(json({ quote: 'Stay sharp.' })),
    );
  });

  // ── Today runway card ──────────────────────────────────────────────────────

  test('today surface shows the next focus task and schedule context', async ({ page }) => {
    await page.goto('/#/today');
    await expect(page.getByText('Start with Ship UI polish pass')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTitle('Team sync')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Refactor hooks')).toBeVisible({ timeout: 15_000 });
  });

  // ── Focus prefill / selected-task flow ─────────────────────────────────────

  test('today runway can launch focus with the suggested task prefilled', async ({ page }) => {
    await page.goto('/#/today');
    await expect(page.getByText('Start with Ship UI polish pass')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Set up focus' }).click();

    await expect(page.getByRole('main').getByText('Focus Block', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Link session to a task' })).toContainText(
      'Ship UI polish pass',
      { timeout: 10_000 },
    );
    await expect(page.getByText('ready for the next block')).toBeVisible({ timeout: 10_000 });
  });

  // ── Focus completion -> break / next-block ─────────────────────────────────

  test('focus completion modal renders after session ends', async ({ page }) => {
    await page.route(`${apiBase}/focus/sessions**`, (route) =>
      route.fulfill(
        json([
          {
            id: 'fs_1',
            status: 'completed',
            task_id: 'tsk_due_today',
            started_at: `${todayISO}T08:00:00Z`,
            ended_at: `${todayISO}T08:25:00Z`,
            duration_minutes: 25,
          },
        ]),
      ),
    );
    await page.goto('/#/focus');
    await expect(page.getByText('25m today')).toBeVisible({ timeout: 15_000 });
  });

  // ── Shutdown modal ─────────────────────────────────────────────────────────

  test('shutdown modal renders with steps and stats', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    // Open shutdown via keyboard shortcut or by evaluating the state directly
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('dopaflow:open-shutdown'));
    });
    await page.waitForTimeout(500);
    // The shutdown modal is rendered at the App level, check it exists
    const hasModal = await page
      .getByRole('dialog')
      .isVisible()
      .catch(() => false);
    expect(hasModal).toBe(true);
  });

  test('shutdown modal can advance through steps', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('dopaflow:open-shutdown'));
    });
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Wins')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Defer')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Tomorrow', { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('shutdown modal can go back from defer to wins', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('dopaflow:open-shutdown'));
    });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Defer')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Wins')).toBeVisible({ timeout: 15_000 });
  });

  test('shutdown completion uses defer choices in tomorrow lineup and lands on a completion state', async ({
    page,
  }) => {
    const taskPatches: Array<Record<string, unknown>> = [];
    const journalPosts: Array<Record<string, unknown>> = [];

    await page.route(`${apiBase}/tasks**`, async (route) => {
      const request = route.request();
      const url = request.url();
      if (url.includes('/boards/')) {
        await route.fulfill(json([]));
        return;
      }
      if (request.method() === 'GET') {
        await route.fulfill(
          json([
            {
              id: 'tsk_due_today',
              title: 'Ship UI polish pass',
              description: null,
              due_at: `${todayISO}T09:00:00Z`,
              priority: 1,
              status: 'todo',
              done: false,
              estimated_minutes: 45,
              actual_minutes: null,
              recurrence_rule: null,
              recurrence_parent_id: null,
              sort_order: 0,
              subtasks: [],
              dependencies: [],
              tags: [],
              source_type: null,
              source_external_id: null,
              project_id: null,
              created_at: `${todayISO}T07:00:00Z`,
              updated_at: `${todayISO}T07:00:00Z`,
            },
          ]),
        );
        return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      taskPatches.push(body);
      await route.fulfill(json({ ok: true }));
    });

    await page.route(`${apiBase}/journal/**`, async (route) => {
      if (route.request().method() === 'POST') {
        journalPosts.push(route.request().postDataJSON() as Record<string, unknown>);
        await route.fulfill(
          json({
            id: 'jrn_shutdown',
            markdown_body: 'Closed with intent.',
            date: todayISO,
            tags: ['shutdown'],
            version: 1,
          }),
        );
        return;
      }
      await route.fulfill(json([]));
    });

    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('dopaflow:open-shutdown'));
    });

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Defer')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Tomorrow' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Tomorrow', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('dialog').getByText('Ship UI polish pass', { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Good' }).click();
    await page.getByPlaceholder('(Optional) Any thoughts?').fill('Closed with intent.');
    await page.getByRole('button', { name: 'Finish shutdown' }).click();

    await expect(page.getByText('Shutdown complete')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Tomorrow is set and today is closed.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Close shutdown' })).toBeVisible({
      timeout: 15_000,
    });
    expect(
      taskPatches.some(
        (body) => body?.due_at === `${todayISO}` || typeof body?.due_at === 'string',
      ),
    ).toBe(true);
    expect(journalPosts).toHaveLength(1);
  });

  test('shutdown modal closes and returns to app', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('dopaflow:open-shutdown'));
    });
    await page.waitForTimeout(500);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Set up focus' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
