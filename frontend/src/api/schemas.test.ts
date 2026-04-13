import { describe, expect, it } from 'vitest';
import {
  taskSchema,
  habitSchema,
  calendarEventSchema,
  alarmRecordSchema,
  focusSessionSchema,
  reviewCardSchema,
  parseApiSchema,
} from './schemas';

describe('taskSchema', () => {
  it('parses a valid minimal task', () => {
    const result = taskSchema.parse({
      id: 'tsk_123',
      title: 'Test task',
      priority: 2,
      status: 'todo',
      done: false,
      sort_order: 0,
      subtasks: [],
      tags: [],
      dependencies: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(result.id).toBe('tsk_123');
    expect(result.title).toBe('Test task');
  });

  it('rejects an invalid status', () => {
    expect(() =>
      taskSchema.parse({
        id: 'tsk_123',
        title: 'Test',
        priority: 2,
        status: 'invalid_status',
        done: false,
        sort_order: 0,
        subtasks: [],
        tags: [],
        dependencies: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }),
    ).toThrow();
  });

  it('accepts optional nullable fields as null', () => {
    const result = taskSchema.parse({
      id: 'tsk_123',
      title: 'Test',
      priority: 2,
      status: 'done',
      done: true,
      sort_order: 0,
      subtasks: [],
      tags: [],
      dependencies: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      due_at: null,
      description: null,
      estimated_minutes: null,
    });
    expect(result.due_at).toBeNull();
    expect(result.description).toBeNull();
  });
});

describe('habitSchema', () => {
  it('parses a valid habit', () => {
    const result = habitSchema.parse({
      id: 'hab_123',
      name: 'Morning walk',
      target_freq: 1,
      target_period: 'daily',
      color: '#ff0000',
      current_streak: 5,
      best_streak: 10,
    });
    expect(result.name).toBe('Morning walk');
    expect(result.current_streak).toBe(5);
  });

  it('rejects a non-numeric streak', () => {
    expect(() =>
      habitSchema.parse({
        id: 'hab_123',
        name: 'Walk',
        target_freq: 1,
        target_period: 'daily',
        color: '#ff0000',
        current_streak: 'bad',
        best_streak: 10,
      }),
    ).toThrow();
  });
});

describe('calendarEventSchema', () => {
  it('parses a valid event with all fields', () => {
    const result = calendarEventSchema.parse({
      id: 'evt_123',
      title: 'Meeting',
      start_at: '2026-04-13T10:00:00Z',
      end_at: '2026-04-13T11:00:00Z',
      all_day: false,
      sync_status: 'local_only',
      provider_readonly: false,
      created_at: '2026-04-13T00:00:00Z',
      updated_at: '2026-04-13T00:00:00Z',
    });
    expect(result.title).toBe('Meeting');
    expect(result.sync_status).toBe('local_only');
  });

  it('rejects an invalid sync_status', () => {
    expect(() =>
      calendarEventSchema.parse({
        id: 'evt_123',
        title: 'Meeting',
        start_at: '2026-04-13T10:00:00Z',
        end_at: '2026-04-13T11:00:00Z',
        all_day: false,
        sync_status: 'invalid',
        provider_readonly: false,
        created_at: '2026-04-13T00:00:00Z',
        updated_at: '2026-04-13T00:00:00Z',
      }),
    ).toThrow();
  });
});

describe('alarmRecordSchema', () => {
  it('parses a valid alarm', () => {
    const result = alarmRecordSchema.parse({
      id: 'alm_123',
      at: '2026-04-13T08:00:00Z',
      title: 'Morning standup',
      kind: 'alarm',
    });
    expect(result.title).toBe('Morning standup');
    expect(result.kind).toBe('alarm');
  });
});

describe('focusSessionSchema', () => {
  it('parses a valid focus session', () => {
    const result = focusSessionSchema.parse({
      id: 'fcs_123',
      started_at: '2026-04-13T10:00:00Z',
      duration_minutes: 25,
      status: 'running',
    });
    expect(result.duration_minutes).toBe(25);
  });
});

describe('reviewCardSchema', () => {
  it('parses a valid review card', () => {
    const result = reviewCardSchema.parse({
      id: 'rc_123',
      deck_id: 'dk_123',
      front: 'What is ADHD?',
      back: 'Attention Deficit Hyperactivity Disorder',
      interval: 1,
      ease_factor: 2.5,
      lapse_count: 0,
      reviews_done: 5,
    });
    expect(result.front).toBe('What is ADHD?');
    expect(result.ease_factor).toBe(2.5);
  });
});

describe('parseApiSchema', () => {
  it('returns parsed value on success', () => {
    const result = parseApiSchema(taskSchema, {
      id: 'tsk_123',
      title: 'Test',
      priority: 2,
      status: 'todo',
      done: false,
      sort_order: 0,
      subtasks: [],
      tags: [],
      dependencies: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect((result as ReturnType<typeof taskSchema.parse>).id).toBe('tsk_123');
  });

  it('throws with Zod error message on failure', () => {
    expect(() =>
      parseApiSchema(taskSchema, {
        id: 'tsk_123',
        title: 'Test',
        priority: 2,
        status: 'invalid',
        done: false,
        sort_order: 0,
        subtasks: [],
        tags: [],
        dependencies: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }),
    ).toThrow();
  });
});
