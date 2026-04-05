import { useRef, useState } from "react";
import Button from "@ds/primitives/Button";
import { API_BASE_URL } from "../api/client";

interface VoiceDictationProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceDictation({ onTranscript, disabled = false }: VoiceDictationProps): JSX.Element {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const unavailable = disabled || typeof navigator === "undefined" || !navigator.mediaDevices;

  const stopTracks = (): void => streamRef.current?.getTracks().forEach((track) => track.stop());
  const toggle = async (): Promise<void> => {
    setError(null);
    if (recording && recorderRef.current) return recorderRef.current.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        setRecording(false);
        stopTracks();
        try {
          const form = new FormData();
          form.append("file", new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }), "dictation.webm");
          const response = await fetch(`${API_BASE_URL}/journal/transcribe`, { method: "POST", body: form });
          const result = (await response.json()) as { transcript?: string; error?: string };
          if (!response.ok) throw new Error(result.error ?? "transcription_failed");
          onTranscript(result.transcript ?? "");
        } catch (exc) {
          setError(exc instanceof Error ? exc.message : "Dictation failed");
        }
      };
      recorder.start();
      setRecording(true);
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Microphone unavailable";
      setError(/denied|notallowed|permission/i.test(message) ? "Microphone permission denied by the browser." : message);
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
