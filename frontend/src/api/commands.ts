import type { VoiceCommandPreview } from "../../../shared/types";
import { apiClient } from "./client";

export interface CommandExecuteResponse {
  intent: string;
  status: string;
  result?: Record<string, unknown> | null;
  reply?: string | null;
  message?: string | null;
}

export interface CommandListItem {
  id: string;
  name: string;
  description: string;
  category: string;
  example: string;
  text: string;
}

export interface CommandListResponse {
  commands: CommandListItem[];
}

export function previewVoiceCommand(file: Blob, filename = "voice.webm", lang = "en-US"): Promise<VoiceCommandPreview> {
  const form = new FormData();
  form.append("file", file, filename);
  return apiClient<VoiceCommandPreview>(`/commands/voice-preview?lang=${encodeURIComponent(lang)}`, {
    method: "POST",
    body: form,
  });
}

export function executeCommandText(text: string, confirm = true, source: "text" | "voice" = "text"): Promise<CommandExecuteResponse> {
  return apiClient<CommandExecuteResponse>("/commands/execute", {
    method: "POST",
    body: JSON.stringify({ text, confirm, source }),
  });
}

export function getCommandList(): Promise<CommandListResponse> {
  return apiClient<CommandListResponse>("/commands/list");
}
