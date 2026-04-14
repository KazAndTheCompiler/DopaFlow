import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});


describe('focus API', () => {
  it('listFocusSessions calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listFocusSessions } = await import('./focus');
    await listFocusSessions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/focus/sessions');
  });

  it('startFocusSession posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'sess_1', started_at: '2024-01-01T09:00:00Z', duration_minutes: 25, status: 'active' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { startFocusSession } = await import('./focus');
    await startFocusSession({ duration_minutes: 25 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/focus/sessions');
    expect(options.method).toBe('POST');
  });

  it('controlFocusSession posts with action payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'sess_1', started_at: '2024-01-01T09:00:00Z', duration_minutes: 25, status: 'active' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { controlFocusSession } = await import('./focus');
    await controlFocusSession({ action: 'pause' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.action).toBe('pause');
  });
});

describe('gamification API', () => {
  it('getGamificationStatus calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ level: 1, badges: [], earned_count: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getGamificationStatus } = await import('./gamification');
    const result = await getGamificationStatus();
    expect(result.level).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/gamification/status');
  });
});

describe('goals API', () => {
  it('listGoals calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listGoals } = await import('./goals');
    await listGoals();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/goals/');
  });

  it('createGoal posts with payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: 'goal_1',
        title: 'Learn Rust',
        horizon: 'year',
        milestones: [],
        created_at: '2024-01-01T00:00:00Z',
        done: false,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { createGoal } = await import('./goals');
    await createGoal({ title: 'Learn Rust', horizon: 'year' });
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.title).toBe('Learn Rust');
    expect(body.horizon).toBe('year');
  });

  it('deleteGoal sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { deleteGoal } = await import('./goals');
    await deleteGoal('goal_1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/goals/goal_1');
    expect(options.method).toBe('DELETE');
  });
});

describe('notifications API', () => {
  it('listNotifications calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listNotifications } = await import('./notifications');
    await listNotifications();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/notifications/');
  });

  it('getUnreadCount returns count', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 5 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getUnreadCount } = await import('./notifications');
    const result = await getUnreadCount();
    expect(result.count).toBe(5);
  });

  it('markNotificationRead posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { markNotificationRead } = await import('./notifications');
    await markNotificationRead('notif_123');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/notifications/notif_123/read');
    expect(options.method).toBe('POST');
  });
});

describe('insights API', () => {
  it('getMomentum calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ score: 75 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getMomentum } = await import('./insights');
    await getMomentum();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/insights/momentum');
  });

  it('getWeeklyDigest returns digest', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: 'Week 15', highlights: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getWeeklyDigest } = await import('./insights');
    const result = await getWeeklyDigest();
    expect(result.title).toBe('Week 15');
  });
});

describe('alarms API', () => {
  it('listAlarms calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listAlarms } = await import('./alarms');
    await listAlarms();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/alarms');
  });

  it('createAlarm posts with payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'alarm_1', at: '09:00', title: 'Morning', kind: 'daily' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { createAlarm } = await import('./alarms');
    await createAlarm({ at: '09:00', title: 'Morning' });
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.at).toBe('09:00');
  });

  it('deleteAlarm sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    const { deleteAlarm } = await import('./alarms');
    await deleteAlarm('alarm_1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/alarms/alarm_1');
    expect(options.method).toBe('DELETE');
  });

  it('getAlarmSchedulerStatus returns status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ running: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getAlarmSchedulerStatus } = await import('./alarms');
    const result = await getAlarmSchedulerStatus();
    expect(result.running).toBe(true);
  });
});

describe('player API', () => {
  it('getQueue normalizes queue items', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: ['url1', 'url2'], count: 2 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getQueue } = await import('./player');
    const result = await getQueue();
    expect(result.items).toEqual([
      { url: 'url1', title: 'url1' },
      { url: 'url2', title: 'url2' },
    ]);
    expect(result.count).toBe(2);
  });

  it('saveQueue sends items in body', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: ['url1'], count: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { saveQueue } = await import('./player');
    await saveQueue([{ url: 'http://example.com', title: 'Example' }]);
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.items).toEqual([{ url: 'http://example.com', title: 'Example' }]);
  });

  it('resolveUrl posts with url', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ stream_url: null, error: 'unavailable' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { resolveUrl } = await import('./player');
    const result = await resolveUrl('http://example.com/video');
    expect(result.error).toBe('unavailable');
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.url).toBe('http://example.com/video');
  });
});

describe('integrations API', () => {
  it('connectGmail posts with payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'connected', url: 'http://callback' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { connectGmail } = await import('./integrations');
    const result = await connectGmail({ code: 'abc123', redirect_uri: 'http://localhost' });
    expect(result.status).toBe('connected');
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.code).toBe('abc123');
  });

  it('importGmailTasks posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ imported_count: 5, status: 'done' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { importGmailTasks } = await import('./integrations');
    const result = await importGmailTasks();
    expect(result.imported_count).toBe(5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/integrations/gmail/import');
  });

  it('getIntegrationsStatus returns status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ gmail: { connected: true }, github: { connected: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getIntegrationsStatus } = await import('./integrations');
    const result = await getIntegrationsStatus();
    expect((result as unknown as Record<string, unknown>).gmail).toBeTruthy();
  });
});

describe('packy API', () => {
  it('askPacky posts with text payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ intent: 'task_create', extracted_data: {}, reply_text: 'Done!' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { askPacky } = await import('./packy');
    const result = await askPacky({ text: 'Create a task' });
    expect(result.intent).toBe('task_create');
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.text).toBe('Create a task');
  });

  it('sendVoiceCommand includes auto_execute', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ intent: 'habit_checkin', reply_text: 'Checked in', extracted_data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { sendVoiceCommand } = await import('./packy');
    await sendVoiceCommand('Check in habit', {}, true);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.auto_execute).toBe(true);
  });

  it('getPackyWhisper returns whisper data', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ mode: 'whisper', transcript: 'hello' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getPackyWhisper } = await import('./packy');
    const result = await getPackyWhisper();
    expect((result as unknown as Record<string, unknown>).transcript).toBe('hello');
  });

  it('updatePackyLorebook posts with lore payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok', session_id: 's1', persisted: true, id: 'lore_1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { updatePackyLorebook } = await import('./packy');
    await updatePackyLorebook({ headline: 'Focus', body: 'Did 25 minutes' });
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.headline).toBe('Focus');
  });

  it('getPackyMomentum returns momentum', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ score: 80, factors: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getPackyMomentum } = await import('./packy');
    const result = await getPackyMomentum();
    expect(result.score).toBe(80);
  });
});

describe('commands API', () => {
  it('executeCommandText posts with text payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ intent: 'task_create', status: 'ok', reply: 'Created' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { executeCommandText } = await import('./commands');
    const result = await executeCommandText('create task buy milk');
    expect(result.intent).toBe('task_create');
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.text).toBe('create task buy milk');
    expect(body.confirm).toBe(true);
    expect(body.source).toBe('text');
  });

  it('executeCommandText sends voice source when specified', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ intent: 'habit_checkin', status: 'ok', reply: 'Done' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { executeCommandText } = await import('./commands');
    await executeCommandText('check in habit', true, 'voice');
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.source).toBe('voice');
  });

  it('getCommandList returns commands', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        commands: [{ id: 'cmd_1', name: 'Create Task', description: 'Creates a task', category: 'tasks', example: 'create task', text: '/task' }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getCommandList } = await import('./commands');
    const result = await getCommandList();
    expect(result.commands.length).toBe(1);
    expect(result.commands[0].name).toBe('Create Task');
  });
});

describe('search API', () => {
  it('search builds URL with query params', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ query: 'task', results: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { search } = await import('./search');
    await search('task');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/search?q=task');
  });

  it('search includes types filter in params', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ query: 'review', results: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { search } = await import('./search');
    await search('review', { types: ['tasks', 'habits'] });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('types=tasks%2Chabits');
  });

  it('search returns formatted results', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        query: 'meeting',
        results: [{ id: 'evt_1', type: 'event', title: 'Team meeting', snippet: 'Weekly sync', date: '2024-01-01' }],
        total: 1,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { search } = await import('./search');
    const result = await search('meeting');
    expect(result.total).toBe(1);
    expect(result.results[0].title).toBe('Team meeting');
  });
});

describe('projects API', () => {
  it('listProjects returns projects array', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'proj_1', name: 'Work', color: '#fff' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listProjects } = await import('./projects');
    const result = await listProjects();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Work');
  });

  it('createProject posts with payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'proj_2', name: 'Personal', color: '#000' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { createProject } = await import('./projects');
    await createProject({ name: 'Personal', color: '#000' });
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.name).toBe('Personal');
    expect(options.method).toBe('POST');
  });

  it('updateProject sends PATCH request', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'proj_1', name: 'Updated', color: '#abc' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { updateProject } = await import('./projects');
    await updateProject('proj_1', { name: 'Updated' });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/projects/proj_1');
    expect(options.method).toBe('PATCH');
  });

  it('deleteProject sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { deleteProject } = await import('./projects');
    await deleteProject('proj_1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/projects/proj_1');
    expect(options.method).toBe('DELETE');
  });
});

describe('sharing API', () => {
  it('listShareTokens returns tokens', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'tok_1', label: 'Work', token: 'abc123' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listShareTokens } = await import('./sharing');
    const result = await listShareTokens();
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('Work');
  });

  it('createShareToken posts with label and expiry', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'tok_2', label: 'Family', token: 'xyz', expires_at: '2025-01-01' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { createShareToken } = await import('./sharing');
    await createShareToken('Family', 60);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.label).toBe('Family');
    expect(body.expires_in_days).toBe(60);
  });

  it('revokeShareToken sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ revoked: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { revokeShareToken } = await import('./sharing');
    await revokeShareToken('tok_1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/calendar/sharing/tokens/tok_1');
    expect(options.method).toBe('DELETE');
  });

  it('listPeerFeeds returns feeds', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'feed_1', label: 'Home', base_url: 'http://localhost' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listPeerFeeds } = await import('./sharing');
    const result = await listPeerFeeds();
    expect(result.length).toBe(1);
  });

  it('addPeerFeed posts with feed payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'feed_2', label: 'Office', base_url: 'http://office' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { addPeerFeed } = await import('./sharing');
    await addPeerFeed({ label: 'Office', base_url: 'http://office', token: 'secret' });
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.label).toBe('Office');
    expect(body.token).toBe('secret');
  });
});

describe('vault API', () => {
  it('getVaultStatus returns status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ connected: true, last_sync: '2024-01-01' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getVaultStatus } = await import('./vault');
    const result = await getVaultStatus();
    expect((result as unknown as Record<string, unknown>).connected).toBe(true);
  });

  it('updateVaultConfig sends PATCH', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ enabled: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { updateVaultConfig } = await import('./vault');
    await updateVaultConfig({ vault_enabled: true });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('PATCH');
  });

  it('pushJournal posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ pushed: 5, status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { pushJournal } = await import('./vault');
    await pushJournal();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/vault/push/journal');
  });

  it('pullJournal posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ pulled: 3, status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { pullJournal } = await import('./vault');
    await pullJournal();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/vault/pull/journal');
  });

  it('resolveVaultConflict sends POST with file path', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    const { resolveVaultConflict } = await import('./vault');
    await resolveVaultConflict('journal/2024-01.md');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/vault/resolve/journal/2024-01.md');
    expect(options.method).toBe('POST');
  });

  it('previewTaskImport returns preview', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [], status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { previewTaskImport } = await import('./vault');
    const result = await previewTaskImport();
    expect((result as unknown as Record<string, unknown>).status).toBe('ok');
  });
});

const mockTask = {
  id: 'task_1',
  title: 'Test task',
  description: null,
  due_at: null,
  priority: 1,
  status: 'todo' as const,
  done: false,
  estimated_minutes: null,
  actual_minutes: null,
  recurrence_rule: null,
  recurrence_parent_id: null,
  sort_order: 0,
  subtasks: [],
  tags: [],
  source_type: null,
  source_external_id: null,
  source_instance_id: null,
  project_id: null,
  dependencies: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('tasks API', () => {
  it('listTasks builds URL with sort param', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([mockTask]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listTasks } = await import('./tasks');
    await listTasks('priority');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('sort_by=priority');
  });

  it('listTasks returns tasks without sort param', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([mockTask]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listTasks } = await import('./tasks');
    const result = await listTasks();
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Test task');
  });

  it('createTask posts with payload', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...mockTask, id: 'task_2', title: 'New task' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { createTask } = await import('./tasks');
    await createTask({ title: 'New task' });
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.title).toBe('New task');
    expect(options.method).toBe('POST');
  });

  it('quickAddTask posts with text', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ preview: 'Buy milk', task_id: 'task_3' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { quickAddTask } = await import('./tasks');
    const result = await quickAddTask({ text: 'Buy milk tomorrow' });
    expect((result as unknown as Record<string, unknown>).preview).toBe('Buy milk');
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.text).toBe('Buy milk tomorrow');
  });

  it('deleteTask sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { deleteTask } = await import('./tasks');
    await deleteTask('task_1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/tasks/task_1');
    expect(options.method).toBe('DELETE');
  });

  it('bulkCompleteTask posts with ids array', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ updated: 3 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { bulkCompleteTask } = await import('./tasks');
    const result = await bulkCompleteTask(['task_1', 'task_2']);
    expect(result.updated).toBe(3);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.ids).toEqual(['task_1', 'task_2']);
  });

  it('bulkDeleteTask posts with ids array', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ updated: 2 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { bulkDeleteTask } = await import('./tasks');
    await bulkDeleteTask(['task_1']);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toContain('task_1');
  });

  it('materializeRecurringTasks posts with window hours', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ created: 5 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { materializeRecurringTasks } = await import('./tasks');
    const result = await materializeRecurringTasks(48);
    expect(result.created).toBe(5);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('window_hours=48');
  });

  it('getTaskContext returns task with context', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ task: mockTask, dependencies: [], dependents: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getTaskContext } = await import('./tasks');
    const result = await getTaskContext('task_1');
    expect(result.task.id).toBe('task_1');
  });

  it('startTaskTimer sends POST', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'log_1', task_id: 'task_1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { startTaskTimer } = await import('./tasks');
    await startTaskTimer('task_1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/tasks/task_1/time/start');
    expect(options.method).toBe('POST');
  });

  it('stopTaskTimer sends POST', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'log_1', task_id: 'task_1', stopped_at: '2024-01-01T10:00:00Z' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { stopTaskTimer } = await import('./tasks');
    await stopTaskTimer('task_1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/tasks/task_1/time/stop');
    expect(options.method).toBe('POST');
  });
});

describe('calendar API', () => {
  it('listCalendarEvents builds URL with date params', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listCalendarEvents } = await import('./calendar');
    await listCalendarEvents({ from: '2024-01-01', until: '2024-01-31' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('from=2024-01-01');
    expect(url).toContain('until=2024-01-31');
  });

  it('deleteCalendarEvent sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { deleteCalendarEvent } = await import('./calendar');
    await deleteCalendarEvent('evt_1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/calendar/events/evt_1');
    expect(options.method).toBe('DELETE');
  });

  it('syncGoogleCalendar posts with fetch_from param', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'syncing' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { syncGoogleCalendar } = await import('./calendar');
    await syncGoogleCalendar({ fetch_from: '2024-01-01' });
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.fetch_from).toBe('2024-01-01');
  });

  it('getCalendarSyncStatus returns status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, conflicts: 0, status: 'idle' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getCalendarSyncStatus } = await import('./calendar');
    const result = await getCalendarSyncStatus();
    expect(result.ok).toBe(true);
    expect(result.conflicts).toBe(0);
  });

  it('listSyncConflicts returns conflicts', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 1, local: {}, incoming: {} }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listSyncConflicts } = await import('./calendar');
    const result = await listSyncConflicts();
    expect(result.length).toBe(1);
  });

  it('resolveSyncConflict posts with resolution', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, local: {}, incoming: {}, resolution: 'prefer_local' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { resolveSyncConflict } = await import('./calendar');
    await resolveSyncConflict(1, 'prefer_local');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/calendar/sync/conflicts/1/resolve');
    const body = JSON.parse(options.body as string);
    expect(body.resolution).toBe('prefer_local');
  });
});

describe('review API', () => {
  it('listReviewDecks returns decks', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'deck_1', name: 'Main', card_count: 10 }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listReviewDecks } = await import('./review');
    const result = await listReviewDecks();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Main');
  });

  it('getDeckStats returns stats for deck', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ deck_id: 'deck_1', deck_name: 'Main', total_cards: 10, due_cards: 3, suspended_count: 1, average_interval: 5 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getDeckStats } = await import('./review');
    const result = await getDeckStats('deck_1');
    expect(result.due_cards).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/review/decks/deck_1/stats');
  });

  it('createReviewDeck posts with name', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'deck_2', name: 'Spanish', source_type: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { createReviewDeck } = await import('./review');
    await createReviewDeck({ name: 'Spanish' });
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.name).toBe('Spanish');
    expect(options.method).toBe('POST');
  });

  it('renameReviewDeck sends PATCH', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'deck_1', name: 'Renamed' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { renameReviewDeck } = await import('./review');
    await renameReviewDeck('deck_1', 'Renamed');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/review/decks/deck_1');
    expect(options.method).toBe('PATCH');
  });

  it('deleteReviewDeck sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { deleteReviewDeck } = await import('./review');
    await deleteReviewDeck('deck_1');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/review/decks/deck_1');
    expect(options.method).toBe('DELETE');
  });
});

describe('journal API', () => {
  it('listJournalEntries builds URL with tag param', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listJournalEntries } = await import('./journal');
    await listJournalEntries({ tag: 'work' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/journal/entries?tag=work');
  });

  it('listJournalEntries builds URL with search param', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listJournalEntries } = await import('./journal');
    await listJournalEntries({ search: 'meeting notes' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('search=meeting+notes');
  });

  it('deleteJournalEntry sends DELETE', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ deleted: true, identifier: '2024-01-01' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { deleteJournalEntry } = await import('./journal');
    await deleteJournalEntry('2024-01-01');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/journal/entries/2024-01-01');
    expect(options.method).toBe('DELETE');
  });

  it('getJournalBackupStatus returns backup info', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ backup_path: '/backup/journal', last_backup_at: '2024-01-01T00:00:00Z' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getJournalBackupStatus } = await import('./journal');
    const result = await getJournalBackupStatus();
    expect(result.backup_path).toBe('/backup/journal');
  });

  it('triggerJournalBackup posts to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Backup triggered', backed_up_date: '2024-01-01' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { triggerJournalBackup } = await import('./journal');
    await triggerJournalBackup('2024-01-01');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/journal/backup/trigger?date=2024-01-01');
    expect(options.method).toBe('POST');
  });

  it('getJournalGraph returns graph data', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ nodes: [], edges: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getJournalGraph } = await import('./journal');
    const result = await getJournalGraph();
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
  });

  it('getJournalBacklinks returns backlink identifiers', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(['2024-01-02', '2024-01-03']), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { getJournalBacklinks } = await import('./journal');
    const result = await getJournalBacklinks('2024-01-01');
    expect(result).toEqual(['2024-01-02', '2024-01-03']);
  });

  it('exportJournalToday posts to export endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ path: '/exports/2024-01-01.md', entry_count: 3 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { exportJournalToday } = await import('./journal');
    const result = await exportJournalToday();
    expect(result.entry_count).toBe(3);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/journal/export-today');
    expect(options.method).toBe('POST');
  });

  it('listJournalTemplates returns templates', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'tmpl_1', name: 'Daily Standup' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { listJournalTemplates } = await import('./journal');
    const result = await listJournalTemplates();
    expect(result[0].name).toBe('Daily Standup');
  });

  it('applyJournalTemplate posts template id', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ body: '# Daily\n\n', tags: ['daily'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { applyJournalTemplate } = await import('./journal');
    const result = await applyJournalTemplate('tmpl_1');
    expect(result.body).toContain('Daily');
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/journal/templates/tmpl_1/apply');
    expect(options.method).toBe('POST');
  });
});
