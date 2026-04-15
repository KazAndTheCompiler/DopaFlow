import { useCallback, useEffect, useRef, useState } from 'react';

import type { Alarm } from '../../../shared/types';
import {
  createAlarm,
  deleteAlarm,
  getAlarmSchedulerStatus,
  listAlarms,
  triggerAlarm,
} from '@api/index';
import { getInvalidationEventName } from './useSSE';
import { useTTS } from './useTTS';

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

export function useAlarms(): UseAlarmsResult {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [active_alarm_id, setActiveAlarmId] = useState<string | null>(null);
  const [next_alarm_at, setNextAlarmAt] = useState<string | null>(null);
  const [schedulerRunning, setSchedulerRunning] = useState<boolean>(false);
  const firedRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const { speak } = useTTS();

  const clearScheduledTimeouts = useCallback((): void => {
    for (const timeoutId of timeoutRef.current.values()) {
      clearTimeout(timeoutId);
    }
    timeoutRef.current.clear();
  }, []);

  const fireLocally = useCallback(
    (alarm: Alarm): void => {
      if (alarm.muted || firedRef.current.has(alarm.id)) {
        return;
      }
      firedRef.current.add(alarm.id);
      if (alarm.kind === 'tts' || alarm.kind == null) {
        const text = alarm.tts_text || alarm.title;
        speak(text);
      }
      void triggerAlarm(alarm.id).catch(() => undefined);
    },
    [speak],
  );

  const refresh = useCallback(async (): Promise<void> => {
    const [nextAlarms, status] = await Promise.all([listAlarms(), getAlarmSchedulerStatus()]);
    setAlarms(nextAlarms);
    setActiveAlarmId(status.active_alarm_id ?? null);
    setNextAlarmAt(status.next_alarm_at ?? null);
    setSchedulerRunning(status.running);
    clearScheduledTimeouts();

    // Browser-side fallback so local web release alarms work even without OS TTS binaries.
    const now = Date.now();
    for (const alarm of nextAlarms) {
      if (alarm.muted) {
        continue;
      }
      const alarmTime = new Date(alarm.at).getTime();
      if (Number.isNaN(alarmTime)) {
        continue;
      }
      if (alarmTime <= now && now - alarmTime < 2 * 60_000) {
        fireLocally(alarm);
        continue;
      }
      if (alarmTime > now && !firedRef.current.has(alarm.id)) {
        const delay = Math.min(alarmTime - now, 2_147_483_647);
        const timeoutId = setTimeout(() => fireLocally(alarm), delay);
        timeoutRef.current.set(alarm.id, timeoutId);
      }
    }
  }, [clearScheduledTimeouts, fireLocally]);

  // Register service worker and request notification permission
  useEffect(() => {
    if (
      window.location.protocol === 'file:' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost'
    ) {
      return;
    }

    const registerSW = async () => {
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/alarm-sw.js', { scope: '/' });
          // Request notification permission
          if ('Notification' in window && Notification.permission === 'default') {
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
    if (
      window.location.protocol === 'file:' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === 'localhost'
    ) {
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'ALARM_FIRED') {
          const alarm = event.data.alarm as Alarm;
          const text = event.data.text as string;
          // Only speak if tab is visible and not already fired
          if (
            !firedRef.current.has(alarm.id) &&
            !alarm.muted &&
            (alarm.kind === 'tts' || alarm.kind == null) &&
            document.visibilityState === 'visible'
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
    const handleInvalidate = (): void => {
      void refresh();
    };
    window.addEventListener(getInvalidationEventName('alarms'), handleInvalidate);
    return () => {
      window.removeEventListener(getInvalidationEventName('alarms'), handleInvalidate);
      clearScheduledTimeouts();
    };
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
      const alarm = alarms.find((item) => item.id === id);
      if (alarm && !alarm.muted && (alarm.kind === 'tts' || alarm.kind == null)) {
        firedRef.current.add(alarm.id);
        speak(alarm.tts_text || alarm.title);
      }
      await refresh();
    },
  };
}
