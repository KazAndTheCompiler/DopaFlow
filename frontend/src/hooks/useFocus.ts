import { useEffect, useState } from "react";

import type { FocusSession, TaskId } from "../../../shared/types";
import { controlFocusSession, listFocusSessions, startFocusSession } from "@api/index";

export interface UseFocusResult {
  sessions: FocusSession[];
  activeSession?: FocusSession | undefined;
  refresh: () => Promise<void>;
  start: (taskId?: string, minutes?: number) => Promise<void>;
  control: (action: "paused" | "running" | "completed") => Promise<void>;
}

export function useFocus(): UseFocusResult {
  const [sessions, setSessions] = useState<FocusSession[]>([]);

  const refresh = async (): Promise<void> => {
    setSessions(await listFocusSessions());
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    sessions,
    activeSession: sessions.find((session) => session.status === "running"),
    refresh,
    start: async (taskId?: string, minutes = 25) => {
      await startFocusSession({
        ...(taskId !== undefined ? { task_id: taskId as TaskId } : {}),
        started_at: new Date().toISOString(),
        duration_minutes: minutes,
      });
      await refresh();
    },
    control: async (action: "paused" | "running" | "completed") => {
      await controlFocusSession({
        action,
        ...(action === "completed" ? { ended_at: new Date().toISOString() } : {}),
      });
      await refresh();
    },
  };
}
