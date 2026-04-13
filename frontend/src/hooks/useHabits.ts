import { useCallback, useEffect, useState } from 'react';

import type { Habit } from '../../../shared/types';
import { showToast } from '@ds/primitives/Toast';
import {
  checkInHabit,
  createHabit,
  freezeHabit,
  getHabitLogs,
  listHabits,
  unfreezeHabit,
} from '@api/index';
import { getInvalidationEventName } from './useSSE';

export interface UseHabitsResult {
  habits: Habit[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (habit: Partial<Habit>) => Promise<Habit>;
  checkIn: (habitId: string, moodScore?: number) => Promise<void>;
  freeze: (habitId: string, days: number) => Promise<void>;
  unfreeze: (habitId: string) => Promise<void>;
  getLogs: (habitId: string) => Promise<{ habit_id: string; checkin_date: string }[]>;
}

export function useHabits(): UseHabitsResult {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setHabits(await listHabits());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load habits';
      setError(msg);
      showToast('Could not load habits.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleInvalidate = (): void => {
      void refresh();
    };
    window.addEventListener(getInvalidationEventName('habits'), handleInvalidate);
    return () => window.removeEventListener(getInvalidationEventName('habits'), handleInvalidate);
  }, [refresh]);

  const freeze = useCallback(
    async (habitId: string, days: number): Promise<void> => {
      await freezeHabit(habitId, days);
      await refresh();
    },
    [refresh],
  );

  const unfreeze = useCallback(
    async (habitId: string): Promise<void> => {
      await unfreezeHabit(habitId);
      await refresh();
    },
    [refresh],
  );

  const getLogs = useCallback(
    (habitId: string): Promise<{ habit_id: string; checkin_date: string }[]> =>
      getHabitLogs(habitId),
    [],
  );

  return {
    habits,
    loading,
    error,
    refresh,
    create: async (habit: Partial<Habit>) => {
      const result = await createHabit(habit);
      setHabits((prev) => {
        const existing = prev.find((entry) => entry.id === result.id);
        if (existing) {
          return prev.map((entry) => (entry.id === result.id ? result : entry));
        }
        return [...prev, result];
      });
      showToast('Habit created.', 'success');
      return result;
    },
    checkIn: async (habitId: string, moodScore?: number) => {
      try {
        await checkInHabit({
          habitId,
          checkedAt: new Date().toISOString(),
          ...(moodScore !== undefined ? { moodScore } : {}),
        });
        await refresh();
        showToast('Habit checked in. ST updated.', 'success');
      } catch {
        await refresh(); // rollback via real data
        showToast('Check-in failed.', 'error');
      }
    },
    freeze,
    unfreeze,
    getLogs,
  };
}
