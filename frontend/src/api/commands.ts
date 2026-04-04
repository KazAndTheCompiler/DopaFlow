import { apiClient } from "./client";

export interface VoiceCommandPreview {
  transcript: string;
  status: string;
  command_word: string | null;
  parsed: Record<string, unknown>;
  preview: Record<string, unknown>;
}

export function previewVoiceCommand(file: Blob, filename = "voice.webm", lang = "en-US"): Promise<VoiceCommandPreview> {
  const form = new FormData();
  form.append("file", file, filename);
  return apiClient<VoiceCommandPreview>(`/commands/voice-preview?lang=${encodeURIComponent(lang)}`, {
    method: "POST",
    body: form,
  });
}

export function executeCommandText(text: string, confirm = true, source: "text" | "voice" = "text"): Promise<Record<string, unknown>> {
  return apiClient<Record<string, unknown>>("/commands/execute", {
    method: "POST",
    body: JSON.stringify({ text, confirm, source }),
  });
}
