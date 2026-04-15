import { useCallback, useEffect, useState } from 'react';
import { materializeRecurringTasks } from '../api/tasks';

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
      // Only show the error screen for genuine network failures (backend unreachable).
      // HTTP 4xx/5xx means the server responded — don't block the whole app.
      const msg = caughtError instanceof Error ? caughtError.message : '';
      if (msg.startsWith('network_error:')) {
        setError(caughtError instanceof Error ? caughtError : new Error('Failed to bootstrap app'));
      }
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return { initialize, error };
}
