import type { FocusSession } from "../../../shared/types";
import { apiClient } from "./client";

export function listFocusSessions(): Promise<FocusSession[]> {
  return apiClient<FocusSession[]>("/focus/sessions");
}

export function startFocusSession(payload: Partial<FocusSession>): Promise<FocusSession> {
  return apiClient<FocusSession>("/focus/sessions", { method: "POST", body: JSON.stringify(payload) });
}

export function controlFocusSession(payload: { action: string; ended_at?: string }): Promise<FocusSession> {
  return apiClient<FocusSession>("/focus/sessions/control", { method: "POST", body: JSON.stringify(payload) });
}

