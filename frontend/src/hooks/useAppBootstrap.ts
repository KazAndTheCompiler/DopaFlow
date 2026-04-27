import { useCallback, useEffect, useState } from "react";
import { materializeRecurringTasks } from "../api/tasks";

export interface UseAppBootstrapResult {
  initialize: () => Promise<void>;
  error: Error | null;
}

export function useAppBootstrap(): UseAppBootstrapResult {
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await materializeRecurringTasks(168);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error("Failed to bootstrap app");
      setError(nextError);
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return { initialize, error };
}
