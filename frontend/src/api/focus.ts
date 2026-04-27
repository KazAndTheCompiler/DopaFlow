import type { FocusSession } from "../../../shared/types";
import { apiClient } from "./client";
import {
  focusSessionSchema,
  focusSessionsSchema,
  parseApiSchema,
} from "./schemas";

export async function listFocusSessions(): Promise<FocusSession[]> {
  return parseApiSchema<FocusSession[]>(
    focusSessionsSchema,
    await apiClient<unknown>("/focus/sessions"),
  );
}

export async function startFocusSession(
  payload: Partial<FocusSession>,
): Promise<FocusSession> {
  return parseApiSchema<FocusSession>(
    focusSessionSchema,
    await apiClient<unknown>("/focus/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function controlFocusSession(payload: {
  action: string;
  ended_at?: string;
}): Promise<FocusSession> {
  return parseApiSchema<FocusSession>(
    focusSessionSchema,
    await apiClient<unknown>("/focus/sessions/control", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}
