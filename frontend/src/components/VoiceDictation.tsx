import { useState } from "react";
import Button from "@ds/primitives/Button";
import { useMicrophone } from "@hooks/useMicrophone";
import { API_BASE_URL } from "../api/client";

interface VoiceDictationProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceDictation({ onTranscript, disabled = false }: VoiceDictationProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const unavailable = disabled || typeof navigator === "undefined" || !navigator.mediaDevices;
  const { isRecording, start, stop, error: microphoneError } = useMicrophone({
    onStop: async (blob, mimeType) => {
      try {
        if (blob.size < 100) {
          setError("Recording too short — please hold the button while speaking.");
          return;
        }
        const ext = mimeType.includes("mp4") ? ".mp4" : ".webm";
        const form = new FormData();
        form.append("file", blob, `dictation${ext}`);
        const lang = navigator.language || "en-US";
        const response = await fetch(`${API_BASE_URL}/journal/transcribe?lang=${encodeURIComponent(lang)}`, { method: "POST", body: form });
        const result = (await response.json()) as { transcript?: string; error?: string };
        if (!response.ok) throw new Error(result.error ?? "transcription_failed");
        const text = result.transcript?.trim();
        if (!text) {
          setError("No speech detected — try speaking louder or closer to the mic.");
          return;
        }
        onTranscript(text);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Dictation failed");
      }
    },
  });

  const toggle = async (): Promise<void> => {
    setError(null);
    if (isRecording) {
      stop();
      return;
    }
    await start();
  };

  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <Button
        disabled={unavailable}
        title={unavailable ? "Microphone unavailable" : undefined}
        onClick={() => void toggle()}
        variant="secondary"
        style={{ width: "fit-content", display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.4rem 0.7rem" }}
      >
        {isRecording ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--state-error)", animation: "pulse 1s infinite" }} /> : null}
        {isRecording ? "Stop recording" : "Dictate"}
      </Button>
      {error || microphoneError ? <span style={{ color: "var(--state-error)", fontSize: "var(--text-sm)" }}>{error ?? microphoneError}</span> : null}
    </div>
  );
}

export default VoiceDictation;
