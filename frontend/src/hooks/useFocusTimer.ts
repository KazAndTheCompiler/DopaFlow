import { useState, useEffect, useMemo } from "react";
import type { FocusSession } from "../../../shared/types";

export interface UseFocusTimerResult {
  activeTimerLabel: string | undefined;
}

export function useFocusTimer(
  activeSession: FocusSession | null | undefined,
  focusNow: number
): UseFocusTimerResult {
  const activeTimerLabel = useMemo(() => {
    const session = activeSession;
    if (!session) return undefined;
    const totalSeconds = Math.max(0, Math.round((session.duration_minutes ?? 0) * 60));
    if (!session.started_at) {
      return `${session.duration_minutes}m ${session.status}`;
    }
    const startedAt = new Date(session.started_at).getTime();
    if (Number.isNaN(startedAt)) {
      return `${session.duration_minutes}m ${session.status}`;
    }
    const pausedSeconds = Math.floor((session.paused_duration_ms ?? 0) / 1000);
    const elapsedSeconds = Math.max(0, Math.floor((focusNow - startedAt) / 1000) - pausedSeconds);
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
    const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
    return session.status === "paused"
      ? `${minutes}:${seconds} paused`
      : `${minutes}:${seconds} left`;
  }, [activeSession, focusNow]);

  return { activeTimerLabel };
}

export function useFocusTimerController(activeSession: FocusSession | null | undefined): {
  focusNow: number;
  startTimer: () => void;
} {
  const [focusNow, setFocusNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!activeSession || activeSession.status !== "running") {
      return;
    }
    const intervalId = window.setInterval(() => setFocusNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [activeSession?.id, activeSession?.status]);

  const startTimer = () => setFocusNow(Date.now());

  return { focusNow, startTimer };
}
