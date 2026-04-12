import type { Alarm } from "../../../shared/types";
import { apiClient } from "./client";
import { alarmRecordSchema, alarmRecordsSchema, parseApiSchema } from "./schemas";

export async function listAlarms(): Promise<Alarm[]> {
  return parseApiSchema<Alarm[]>(alarmRecordsSchema, await apiClient<unknown>("/alarms"));
}

export async function createAlarm(payload: Partial<Alarm>): Promise<Alarm> {
  return parseApiSchema<Alarm>(alarmRecordSchema, await apiClient<unknown>("/alarms", { method: "POST", body: JSON.stringify(payload) }));
}

export function deleteAlarm(id: string): Promise<void> {
  return apiClient<void>(`/alarms/${id}`, { method: "DELETE" });
}

export function triggerAlarm(id: string): Promise<{ triggered: boolean }> {
  return apiClient<{ triggered: boolean }>(`/alarms/${id}/trigger`, { method: "POST" });
}

export interface AlarmSchedulerStatus {
  running: boolean;
  active_alarm_id?: string | null;
  next_alarm_id?: string | null;
  next_alarm_at?: string | null;
}

export function getAlarmSchedulerStatus(): Promise<AlarmSchedulerStatus> {
  return apiClient<AlarmSchedulerStatus>("/alarms/scheduler/status");
}
