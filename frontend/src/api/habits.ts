import type { Habit } from "../../../shared/types";
import { apiClient } from "./client";

export function listHabits(): Promise<Habit[]> {
  return apiClient<Habit[]>("/habits");
}

export function createHabit(payload: Partial<Habit>): Promise<Habit> {
  return apiClient<Habit>("/habits/", { method: "POST", body: JSON.stringify(payload) });
}

export function checkInHabit(payload: { habitId: string; checkedAt: string; moodScore?: number }): Promise<Habit> {
  return apiClient<Habit>(`/habits/${payload.habitId}/checkin`, {
    method: "POST",
    body: JSON.stringify({ checked_at: payload.checkedAt, mood_score: payload.moodScore }),
  });
}

export function freezeHabit(habitId: string, days: number): Promise<Habit> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return apiClient<Habit>(`/habits/${habitId}/freeze`, {
    method: "PATCH",
    body: JSON.stringify({ freeze_until: until.toISOString().slice(0, 10) }),
  });
}

export function unfreezeHabit(habitId: string): Promise<Habit> {
  return apiClient<Habit>(`/habits/${habitId}/unfreeze`, { method: "PATCH" });
}

export function getHabitLogs(habitId: string): Promise<{ habit_id: string; checkin_date: string }[]> {
  return apiClient<{ habit_id: string; checkin_date: string }[]>(`/habits/${habitId}/logs`);
}
