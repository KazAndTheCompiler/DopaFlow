import type { MomentumScore, PackyWhisper } from "../../../shared/types";
import { apiClient } from "./client";

export function askPacky(payload: { text: string; context?: Record<string, unknown>; session_id?: string }): Promise<{
  intent: string;
  extracted_data: Record<string, unknown>;
  reply_text: string;
  suggested_action?: string;
}> {
  return apiClient("/packy/ask", { method: "POST", body: JSON.stringify(payload) });
}

export function getPackyWhisper(): Promise<PackyWhisper> {
  return apiClient<PackyWhisper>("/packy/whisper");
}

export function updatePackyLorebook(payload: {
  headline: string;
  body: string;
  completed_today?: number;
  habit_streak?: number;
  focus_minutes_today?: number;
}): Promise<{ status: string }> {
  return apiClient<{ status: string }>("/packy/lorebook", { method: "POST", body: JSON.stringify(payload) });
}

export function getPackyMomentum(): Promise<MomentumScore> {
  return apiClient<MomentumScore>("/packy/momentum");
}
