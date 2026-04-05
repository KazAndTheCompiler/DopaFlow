import { useRef, useState } from "react";

import { executeCommandText, previewVoiceCommand, type VoiceCommandPreview } from "@api/index";
import { showToast } from "@ds/primitives/Toast";
import { Modal } from "@ds/primitives/Modal";
import Button from "@ds/primitives/Button";
import { useTTS } from "@hooks/useTTS";

interface VoiceCommandModalProps {
  initialCommandWord?: "task" | "journal" | "calendar";
  onExecuted?: () => void;
}

const COMMAND_LABELS: Record<NonNullable<VoiceCommandModalProps["initialCommandWord"]>, string> = {
  task: "task",
  journal: "journal entry",
  calendar: "calendar event",
};

export function VoiceCommandModal({ initialCommandWord, onExecuted }: VoiceCommandModalProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<VoiceCommandPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const unavailable = typeof navigator === "undefined" || !navigator.mediaDevices;
  const expectedLabel = initialCommandWord ? COMMAND_LABELS[initialCommandWord] : "command";
  const previewStatus = preview?.status ?? null;
  const previewMessage =
    typeof preview?.preview?.message === "string" ? preview.preview.message : null;
  const canExecute = Boolean(preview?.transcript) && previewStatus === "ok";
  const { speak } = useTTS();

  const speakPreview = (nextPreview: VoiceCommandPreview): void => {
    if (!nextPreview.transcript.trim()) return;
    if (nextPreview.status === "ok") {
      speak(`Heard ${nextPreview.transcript}. Ready to run ${nextPreview.command_word} command.`);
      return;
    }
    if (nextPreview.status === "incomplete") {
      speak(nextPreview.preview?.message && typeof nextPreview.preview.message === "string"
        ? nextPreview.preview.message
        : "More detail needed before I can run that command.");
      return;
    }
    speak(nextPreview.preview?.message && typeof nextPreview.preview.message === "string"
      ? nextPreview.preview.message
      : "Start with task, journal, or calendar.");
  };

  const resetState = (): void => {
    setRecording(false);
    setLoading(false);
    setPreview(null);
    setError(null);
  };

  const close = (): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    chunksRef.current = [];
    setOpen(false);
    resetState();
  };

  const startRecording = async (): Promise<void> => {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = async () => {
      setRecording(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setLoading(true);
      try {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const nextPreview = await previewVoiceCommand(blob, "voice-command.webm");
        if (initialCommandWord && nextPreview.command_word && nextPreview.command_word !== initialCommandWord) {
          const mismatchedPreview = {
            ...nextPreview,
            status: "needs_command_word",
            preview: {
              ...nextPreview.preview,
              status: "needs_command_word",
              message: `This button only accepts ${initialCommandWord} commands.`,
              allowed_prefixes: [initialCommandWord],
            },
          };
          setPreview(mismatchedPreview);
          speakPreview(mismatchedPreview);
          return;
        }
        setPreview(nextPreview);
        speakPreview(nextPreview);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Voice command preview failed");
        speak("Voice command preview failed.");
      } finally {
        setLoading(false);
      }
    };
    recorder.start();
    setRecording(true);
  };

  const toggleRecording = async (): Promise<void> => {
    try {
      if (recording && recorderRef.current) {
        recorderRef.current.stop();
        return;
      }
      await startRecording();
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Microphone unavailable";
      setError(/denied|notallowed|permission/i.test(message) ? "Microphone permission denied by the browser." : message);
    }
  };

  const handleExecute = async (): Promise<void> => {
    if (!canExecute || !preview?.transcript) {
      return;
    }
    setLoading(true);
    try {
      await executeCommandText(preview.transcript, true, "voice");
      showToast("Voice command executed.", "success");
      speak(`Done. ${preview.command_word} command executed.`);
      close();
      onExecuted?.();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Voice command failed");
      speak("Voice command failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        disabled={unavailable}
        onClick={() => {
          setOpen(true);
          resetState();
        }}
        variant="secondary"
        style={{ width: "fit-content" }}
      >
        Voice Command
      </Button>

      <Modal open={open} title="Voice Command" onClose={close}>
        <div style={{ display: "grid", gap: "1rem" }}>
          <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {initialCommandWord ? (
              <>
                Start with <strong>{initialCommandWord}</strong> so this creates a {expectedLabel}. Example:{" "}
                <code>{`${initialCommandWord} `}buy milk tomorrow</code>.
              </>
            ) : (
              <>
                Start with <strong>task</strong>, <strong>journal</strong>, or <strong>calendar</strong>. Example:{" "}
                <code>task buy milk tomorrow</code>.
              </>
            )}
          </p>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <Button onClick={() => void toggleRecording()} disabled={loading} variant={recording ? "primary" : "secondary"}>
              {recording ? "Stop Recording" : "Record Command"}
            </Button>
            {loading ? <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Processing…</span> : null}
          </div>

          {preview ? (
            <div style={{ display: "grid", gap: "0.75rem", padding: "1rem", borderRadius: "14px", background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                  Transcript
                </div>
                <div style={{ fontWeight: 600 }}>{preview.transcript}</div>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                  Status
                </div>
                <div>
                  {previewStatus === "ok" ? `Ready to create: ${preview.command_word}` : null}
                  {previewStatus === "needs_command_word" ? "Needs command word" : null}
                  {previewStatus === "incomplete" ? "More detail needed" : null}
                </div>
              </div>
              {previewMessage ? (
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{previewMessage}</div>
              ) : null}
              {previewStatus !== "ok" ? (
                <div style={{ color: "var(--state-warn)", fontSize: "var(--text-sm)" }}>
                  {previewStatus === "incomplete"
                    ? "Say the date and time, then record again."
                    : initialCommandWord
                    ? `Start with ${initialCommandWord} so this stays on the ${expectedLabel} flow, then record again.`
                    : "Start with task, journal, or calendar, then record again."}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <span style={{ color: "var(--state-overdue)", fontSize: "var(--text-sm)" }}>{error}</span> : null}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button onClick={close} variant="secondary">
              Cancel
            </Button>
            <Button onClick={() => void handleExecute()} disabled={loading || !canExecute} variant="primary">
              Confirm and Run
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default VoiceCommandModal;
