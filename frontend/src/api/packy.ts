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

/** Unified voice command response from Packy. */
export interface PackyVoiceResponse {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  preview: Record<string, unknown>;
  execution_result: Record<string, unknown> | null;
  reply_text: string;
  tts_text: string;
  follow_ups: string[];
  status: string;
}

/**
 * Send a transcript to Packy's unified voice command endpoint.
 * If autoExecute is true the command is executed server-side and the result is returned.
 */
export function sendVoiceCommand(
  text: string,
  context?: Record<string, unknown>,
  autoExecute = false,
): Promise<PackyVoiceResponse> {
  return apiClient<PackyVoiceResponse>("/packy/voice-command", {
    method: "POST",
    body: JSON.stringify({ text, context, auto_execute: autoExecute }),
  });
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
