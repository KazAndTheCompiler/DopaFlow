import type { Habit } from '../../../shared/types';
import { apiClient } from './client';
import { habitSchema, habitsSchema, parseApiSchema } from './schemas';

export async function listHabits(): Promise<Habit[]> {
  return parseApiSchema<Habit[]>(habitsSchema, await apiClient<unknown>('/habits/'));
}

export async function createHabit(payload: Partial<Habit>): Promise<Habit> {
  return parseApiSchema<Habit>(
    habitSchema,
    await apiClient<unknown>('/habits/', { method: 'POST', body: JSON.stringify(payload) }),
  );
}

export async function checkInHabit(payload: {
  habitId: string;
  checkedAt: string;
  moodScore?: number;
}): Promise<Habit> {
  return parseApiSchema<Habit>(
    habitSchema,
    await apiClient<unknown>(`/habits/${payload.habitId}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ checked_at: payload.checkedAt, mood_score: payload.moodScore }),
    }),
  );
}

export async function freezeHabit(habitId: string, days: number): Promise<Habit> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return parseApiSchema<Habit>(
    habitSchema,
    await apiClient<unknown>(`/habits/${habitId}/freeze`, {
      method: 'PATCH',
      body: JSON.stringify({ freeze_until: until.toISOString().slice(0, 10) }),
    }),
  );
}

export async function unfreezeHabit(habitId: string): Promise<Habit> {
  return parseApiSchema<Habit>(
    habitSchema,
    await apiClient<unknown>(`/habits/${habitId}/unfreeze`, { method: 'PATCH' }),
  );
}

export async function updateHabit(habitId: string, payload: Partial<Habit>): Promise<Habit> {
  return parseApiSchema<Habit>(
    habitSchema,
    await apiClient<unknown>(`/habits/${habitId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteHabit(habitId: string): Promise<void> {
  await apiClient<unknown>(`/habits/${habitId}`, { method: 'DELETE' });
}

export function getHabitLogs(
  habitId: string,
): Promise<{ habit_id: string; checkin_date: string }[]> {
  return apiClient<{ habit_id: string; checkin_date: string }[]>(`/habits/${habitId}/logs`);
}
