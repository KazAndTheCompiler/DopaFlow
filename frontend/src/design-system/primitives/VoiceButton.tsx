/**
 * Reusable mic button that drives useSpeechRecognition.
 * Shows pulsing red dot while listening, mic icon at rest.
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
  const iconSize = size === "sm" ? 14 : 18;

  return (
    <button
      onClick={onToggle}
      disabled={!supported}
      title={
        !supported
          ? "Speech recognition not supported in this browser"
          : (title ?? (listening ? "Stop listening" : "Speak a command"))
      }
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: pad,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: listening
          ? "var(--state-overdue)"
          : "var(--border-subtle)",
        background: listening
          ? "color-mix(in srgb, var(--state-overdue) 10%, transparent)"
          : "var(--surface-2)",
        color: listening
          ? "var(--state-overdue)"
          : supported
            ? "var(--text-secondary)"
            : "var(--border)",
        cursor: supported ? "pointer" : "not-allowed",
        transition:
          "border-color 150ms, background 150ms, color 150ms, transform 100ms",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {listening ? (
        // Pulsing dot
        <span
          style={{
            width: size === "sm" ? "0.5rem" : "0.6rem",
            height: size === "sm" ? "0.5rem" : "0.6rem",
            borderRadius: "50%",
            background: "var(--state-overdue)",
            display: "inline-block",
            animation: "pulse 1s ease-in-out infinite",
          }}
        />
      ) : (
        // Mic icon
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
}

export default VoiceButton;
