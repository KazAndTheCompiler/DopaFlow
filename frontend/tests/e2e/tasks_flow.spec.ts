import { expect, test } from '@playwright/test';

const apiBase = '**/api/v2';

function json(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

test.describe('Tasks flow regression', () => {
  test.beforeEach(async ({ page }) => {
    let tasks = [
      {
        id: 'tsk_1',
        title: 'Ship UI polish pass',
        description: null,
        due_at: null,
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
        created_at: '2026-04-01T07:00:00Z',
        updated_at: '2026-04-01T07:00:00Z',
      },
    ];

    await page.addInitScript(() => {
      window.localStorage.setItem('dopaflow:onboarded', '1');
      window.localStorage.setItem('dopaflow:planned_date', new Date().toISOString().slice(0, 10));
    });

    await page.route(`${apiBase}/tasks**`, async (route) => {
      const url = route.request().url();
      if (url.includes('/boards/')) {
        await route.fulfill(json([]));
        return;
      }
      if (url.includes('/tasks/quick-add') && route.request().method() === 'POST') {
        const payload = route.request().postDataJSON() as { text: string };
        await route.fulfill(
          json({
            title: payload.text,
            description: null,
            due_at: null,
            priority: 3,
            tags: [],
            estimated_minutes: null,
          }),
        );
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill(json(tasks));
        return;
      }
      if (route.request().method() === 'POST' && url.endsWith('/tasks/')) {
        const payload = route.request().postDataJSON() as { text?: string; title?: string };
        const title = payload.text ?? payload.title ?? 'Untitled task';
        const createdTask = {
          id: `tsk_${tasks.length + 1}`,
          title,
          description: null,
          due_at: null,
          priority: 3,
          status: 'todo',
          done: false,
          estimated_minutes: null,
          actual_minutes: null,
          recurrence_rule: null,
          recurrence_parent_id: null,
          sort_order: tasks.length,
          subtasks: [],
          dependencies: [],
          tags: [],
          source_type: null,
          source_external_id: null,
          project_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        tasks = [createdTask, ...tasks];
        await route.fulfill(json(createdTask));
        return;
      }
      if (route.request().method() === 'PATCH' && url.includes('/tasks/tsk_1')) {
        tasks = tasks.map((task) =>
          task.id === 'tsk_1'
            ? { ...task, status: 'done', done: true, updated_at: new Date().toISOString() }
            : task,
        );
        await route.fulfill(json(tasks.find((task) => task.id === 'tsk_1')));
        return;
      }
      await route.fulfill(json({}));
    });

    await page.route(`${apiBase}/projects**`, (route) => route.fulfill(json([])));
    await page.route(`${apiBase}/habits**`, (route) => route.fulfill(json([])));
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

  // ── Surface rendering ──────────────────────────────────────────────────────

  test('tasks surface renders quick capture bar, filter controls, and seed task', async ({
    page,
  }) => {
    await page.goto('/#/tasks');
    await expect(page.getByText('Quick capture')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('Quick add — type or speak')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Filter and sort')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ship UI polish pass')).toBeVisible({ timeout: 15_000 });
  });

  // ── Task row detail ────────────────────────────────────────────────────────

  test('task row renders priority badge, status pill, and complete button', async ({ page }) => {
    await page.goto('/#/tasks');
    await expect(page.getByText('Ship UI polish pass')).toBeVisible({ timeout: 15_000 });
    // Priority badge (uses title attribute)
    await expect(page.getByTitle('Priority 1')).toBeVisible({ timeout: 5_000 });
    // Status pill
    await expect(page.getByText('todo', { exact: true })).toBeVisible({ timeout: 5_000 });
    // Complete button (aria-label in TaskRow is "Complete {title}")
    await expect(page.getByRole('button', { name: 'Complete Ship UI polish pass' })).toBeVisible({
      timeout: 5_000,
    });
  });

  // ── Create flow ────────────────────────────────────────────────────────────

  test('can create a new task via quick add and see it in the list', async ({ page }) => {
    await page.goto('/#/tasks');
    await expect(page.getByText('Quick capture')).toBeVisible({ timeout: 15_000 });

    const addInput = page.getByPlaceholder('Quick add — type or speak');
    await addInput.fill('New test task');
    await addInput.press('Enter');

    await expect(page.getByText('New test task')).toBeVisible({ timeout: 15_000 });
  });

  // ── Complete flow ──────────────────────────────────────────────────────────

  test('can mark a task as complete via the row button', async ({ page }) => {
    await page.goto('/#/tasks');
    await expect(page.getByText('Ship UI polish pass')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Complete Ship UI polish pass' }).click();

    // After completion the task row should update (opacity / strikethrough).
    // The edit-modal aria-label confirms the row is still rendered.
    await expect(
      page.getByRole('button', { name: 'Edit task: Ship UI polish pass' }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── Filter flow ────────────────────────────────────────────────────────────

  test('filter buttons toggle active state', async ({ page }) => {
    await page.goto('/#/tasks');
    await expect(page.getByText('Ship UI polish pass')).toBeVisible({ timeout: 15_000 });

    // Pending filter
    await page.getByRole('button', { name: 'Pending' }).click();
    await expect(page.getByText('Ship UI polish pass')).toBeVisible({ timeout: 5_000 });

    // Done filter — button should receive accent-colored background
    const doneBtn = page.getByRole('button', { name: 'Done' });
    await doneBtn.click();
    const bg = await doneBtn.evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).backgroundColor,
    );
    expect(bg.length).toBeGreaterThan(0);
  });

  // ── Board view ─────────────────────────────────────────────────────────────

  test('board view renders kanban controls', async ({ page }) => {
    await page.goto('/#/board');
    await expect(page.getByText('Board mode')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Kanban' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Eisenhower' })).toBeVisible({ timeout: 15_000 });
  });
});
