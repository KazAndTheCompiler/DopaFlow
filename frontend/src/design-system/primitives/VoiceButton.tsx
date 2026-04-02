/**
 * Reusable mic button that drives useSpeechRecognition.
 * Shows pulsing red dot while listening, error state, unsupported state.
 *
 * Usage (controlled):
 *   <VoiceButton listening={listening} supported={supported} onToggle={listening ? stop : start} />
 */

export interface VoiceButtonProps {
  listening: boolean;
  supported: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  title?: string;
}

export function VoiceButton({
  listening,
  supported,
  onToggle,
  size = "md",
  title,
}: VoiceButtonProps): JSX.Element {
  const pad = size === "sm" ? "0.3rem 0.5rem" : "0.45rem 0.7rem";
  const iconSize = size === "sm" ? "0.85rem" : "1rem";

  return (
    <button
      onClick={onToggle}
      disabled={!supported}
      title={!supported ? "Speech recognition not supported in this browser" : (title ?? (listening ? "Stop listening" : "Speak"))}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: pad,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: listening ? "var(--state-overdue)" : "var(--border-subtle)",
        background: listening
          ? "color-mix(in srgb, var(--state-overdue) 10%, transparent)"
          : "var(--surface-2)",
        color: listening ? "var(--state-overdue)" : supported ? "var(--text-secondary)" : "var(--border)",
        cursor: supported ? "pointer" : "not-allowed",
        transition: "border-color 150ms, background 150ms, color 150ms",
        flexShrink: 0,
      }}
    >
      {listening ? (
        // Pulsing dot
        <span
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: "50%",
            background: "var(--state-overdue)",
            display: "inline-block",
            animation: "pulse 1s ease-in-out infinite",
          }}
        />
      ) : (
        <span
          style={{
            fontSize: size === "sm" ? "0.65rem" : "0.72rem",
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          VC
        </span>
      )}
    </button>
  );
}

export default VoiceButton;
