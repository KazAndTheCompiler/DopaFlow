import { useCallback, useEffect, useRef, useState } from "react";

import type { Alarm } from "../../../shared/types";
import {
  createAlarm,
  deleteAlarm,
  getAlarmSchedulerStatus,
  listAlarms,
  triggerAlarm,
} from "@api/index";
import { useTTS } from "./useTTS";

export interface UseAlarmsResult {
  alarms: Alarm[];
  active_alarm_id?: string | null;
  next_alarm_at?: string | null;
  schedulerRunning: boolean;
  refresh: () => Promise<void>;
  create: (alarm: Partial<Alarm>) => Promise<Alarm>;
  remove: (id: string) => Promise<void>;
  trigger: (id: string) => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000;

export function useAlarms(): UseAlarmsResult {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [active_alarm_id, setActiveAlarmId] = useState<string | null>(null);
  const [next_alarm_at, setNextAlarmAt] = useState<string | null>(null);
  const [schedulerRunning, setSchedulerRunning] = useState<boolean>(false);
  const firedRef = useRef<Set<string>>(new Set());
  const { speak } = useTTS();

  const refresh = useCallback(async (): Promise<void> => {
    const [nextAlarms, status] = await Promise.all([listAlarms(), getAlarmSchedulerStatus()]);
    setAlarms(nextAlarms);
    setActiveAlarmId(status.active_alarm_id ?? null);
    setNextAlarmAt(status.next_alarm_at ?? null);
    setSchedulerRunning(status.running);

    // Browser-side TTS poller: fire any alarm whose time has passed and hasn't been spoken yet
    const now = Date.now();
    for (const alarm of nextAlarms) {
      if (alarm.muted) continue;
      if (firedRef.current.has(alarm.id)) continue;
      const alarmTime = new Date(alarm.at).getTime();
      // Fire if within the poll window (past due but not more than 2 minutes stale)
      if (alarmTime <= now && now - alarmTime < 2 * 60_000) {
        firedRef.current.add(alarm.id);
        const text = alarm.tts_text || alarm.title;
        if (alarm.kind === "tts" || alarm.kind == null) {
          speak(text);
        }
      }
    }
  }, [speak]);

  // Register service worker and request notification permission
  useEffect(() => {
    const registerSW = async () => {
      if ("serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register("/alarm-sw.js", { scope: "/" });
          // Request notification permission
          if ("Notification" in window && Notification.permission === "default") {
            await Notification.requestPermission();
          }
        } catch {
          // Silent fail - SW registration is optional
        }
      }
    };

    void registerSW();
  }, []);

  // Listen for messages from service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "ALARM_FIRED") {
          const alarm = event.data.alarm as Alarm;
          const text = event.data.text as string;
          // Only speak if tab is visible and not already fired
          if (
            !firedRef.current.has(alarm.id) &&
            !alarm.muted &&
            (alarm.kind === "tts" || alarm.kind == null) &&
            document.visibilityState === "visible"
          ) {
            firedRef.current.add(alarm.id);
            speak(text);
          }
        }
      });
    }
  }, [speak]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return {
    alarms,
    active_alarm_id,
    next_alarm_at,
    schedulerRunning,
    refresh,
    create: async (alarm: Partial<Alarm>) => {
      const created = await createAlarm(alarm);
      await refresh();
      return created;
    },
    remove: async (id: string) => {
      await deleteAlarm(id);
      await refresh();
    },
    trigger: async (id: string) => {
      await triggerAlarm(id);
      await refresh();
    },
  };
}
