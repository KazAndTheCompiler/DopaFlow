import { useRef, useState } from "react";
import Button from "@ds/primitives/Button";
import { API_BASE_URL } from "../api/client";

interface VoiceDictationProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/** Pick the best available MIME type for MediaRecorder. */
function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const ct of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(ct)) return ct;
    } catch { /* ignore */ }
  }
  return ""; // fall back to browser default
}

export function VoiceDictation({ onTranscript, disabled = false }: VoiceDictationProps): JSX.Element {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const unavailable = disabled || typeof navigator === "undefined" || !navigator.mediaDevices;

  const stopTracks = (): void => streamRef.current?.getTracks().forEach((track) => track.stop());
  const mapMicError = (exc: unknown): string => {
    if (exc && typeof exc === "object" && "name" in exc) {
      const name = String((exc as { name?: unknown }).name ?? "");
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        return "Microphone permission was denied by the browser.";
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        return "No microphone was found for dictation.";
      }
      if (name === "NotReadableError") {
        return "The microphone is busy or unavailable right now.";
      }
    }
    const message = exc instanceof Error ? exc.message : "Microphone unavailable";
    return /denied|notallowed|permission/i.test(message)
      ? "Microphone permission was denied by the browser."
      : message;
  };

  const toggle = async (): Promise<void> => {
    setError(null);
    if (recording && recorderRef.current) return recorderRef.current.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        setRecording(false);
        stopTracks();
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          if (blob.size < 100) {
            setError("Recording too short — please hold the button while speaking.");
            return;
          }
          const ext = (recorder.mimeType || "audio/webm").includes("mp4") ? ".mp4" : ".webm";
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
      };
      recorder.start(250); // collect data every 250ms for reliability
      setRecording(true);
    } catch (exc) {
      setError(mapMicError(exc));
    }
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
        {recording ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--state-error)", animation: "pulse 1s infinite" }} /> : null}
        {recording ? "Stop recording" : "Dictate"}
      </Button>
      {error ? <span style={{ color: "var(--state-error)", fontSize: "var(--text-sm)" }}>{error}</span> : null}
    </div>
  );
}

export default VoiceDictation;
