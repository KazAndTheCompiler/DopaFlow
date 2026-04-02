import { useEffect, useState } from "react";

import type { Habit } from "../../../shared/types";
import { showToast } from "@ds/primitives/Toast";
import { checkInHabit, createHabit, listHabits } from "@api/index";

export interface UseHabitsResult {
  habits: Habit[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (habit: Partial<Habit>) => Promise<Habit>;
  checkIn: (habitId: string, moodScore?: number) => Promise<void>;
}

export function useHabits(): UseHabitsResult {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setHabits(await listHabits());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load habits";
      setError(msg);
      showToast("Could not load habits.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    habits,
    loading,
    error,
    refresh,
    create: async (habit: Partial<Habit>) => {
      const result = await createHabit(habit);
      showToast("Habit created.", "success");
      return result;
    },
    checkIn: async (habitId: string, moodScore?: number) => {
      // Optimistic: bump streak count locally
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habitId ? { ...h, current_streak: h.current_streak + 1 } : h,
        ),
      );
      try {
        await checkInHabit({ habitId, checkedAt: new Date().toISOString(), ...(moodScore !== undefined ? { moodScore } : {}) });
        await refresh();
        showToast("Habit checked in. ST updated.", "success");
      } catch {
        await refresh(); // rollback via real data
        showToast("Check-in failed.", "error");
      }
    },
  };
}
