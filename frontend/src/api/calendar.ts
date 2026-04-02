import type { CalendarEvent, SyncConflict } from "../../../shared/types";
import { apiClient } from "./client";

export function listCalendarEvents(params?: { from?: string; until?: string; category?: string }): Promise<CalendarEvent[]> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.until) qs.set("until", params.until);
  if (params?.category) qs.set("category", params.category);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<CalendarEvent[]>(`/calendar/events${query}`);
}

export function createCalendarEvent(payload: Partial<CalendarEvent>): Promise<CalendarEvent> {
  return apiClient<CalendarEvent>("/calendar/events", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCalendarEvent(id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent> {
  return apiClient<CalendarEvent>(`/calendar/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteCalendarEvent(id: string): Promise<{ deleted: boolean }> {
  return apiClient(`/calendar/events/${id}`, { method: "DELETE" });
}

export function syncGoogleCalendar(payload: { fetch_from?: string }): Promise<{ status: string }> {
  return apiClient("/calendar/google/sync", { method: "POST", body: JSON.stringify(payload) });
}

export function getGoogleCalendarOAuthUrl(redirect_uri: string): Promise<{ status: string; url?: string }> {
  return apiClient(`/calendar/oauth/url?redirect_uri=${encodeURIComponent(redirect_uri)}`);
}

export function getCalendarSyncStatus(): Promise<{ ok: boolean; conflicts: number; status: string }> {
  return apiClient<{ ok: boolean; conflicts: number; status: string }>("/calendar/sync/status");
}

export function listSyncConflicts(): Promise<SyncConflict[]> {
  return apiClient<SyncConflict[]>("/calendar/sync/conflicts");
}

export function resolveSyncConflict(id: number, resolution: "prefer_local" | "prefer_incoming"): Promise<SyncConflict> {
  return apiClient<SyncConflict>(`/calendar/sync/conflicts/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolution }),
  });
}
