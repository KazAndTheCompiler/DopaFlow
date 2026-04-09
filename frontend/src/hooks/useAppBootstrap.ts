import { useEffect } from "react";
import { materializeRecurringTasks } from "../api/tasks";

export interface UseAppBootstrapResult {
  initialize: () => Promise<void>;
}

export function useAppBootstrap(): UseAppBootstrapResult {
  const initialize = async (): Promise<void> => {
    // Materialize recurring tasks on app startup
    await materializeRecurringTasks(168).catch(() => {
      // Silent, fire-and-forget - non-critical startup task
    });
  };

  useEffect(() => {
    void initialize();
  }, []);

  return { initialize };
}
