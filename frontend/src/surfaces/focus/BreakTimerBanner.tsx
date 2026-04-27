import { useEffect, useRef, useState } from "react";

import { APP_STORAGE_KEYS } from "../../app/appStorage";

const BREAK_STORAGE_KEY = APP_STORAGE_KEYS.breakEndsAt;

export interface BreakTimerBannerProps {
  breakEndsAt: Date | null;
  onDismiss: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function BreakTimerBanner({
  breakEndsAt,
  onDismiss,
}: BreakTimerBannerProps): JSX.Element | null {
  const [remaining, setRemaining] = useState<number>(0);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!breakEndsAt) {
      return;
    }

    // Persist break end time so it survives navigation within the session
    localStorage.setItem(BREAK_STORAGE_KEY, breakEndsAt.toISOString());
    dismissedRef.current = false;

    const updateRemaining = () => {
      const now = Date.now();
      const endMs = breakEndsAt.getTime();
      const delta = Math.max(0, Math.floor((endMs - now) / 1000));
      setRemaining(delta);

      if (delta === 0 && !dismissedRef.current) {
        dismissedRef.current = true;
        localStorage.removeItem(BREAK_STORAGE_KEY);
        onDismiss();
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [breakEndsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!breakEndsAt) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: "0.9rem 1rem",
        background:
          "color-mix(in srgb, var(--state-completed, #4ade80) 15%, var(--surface))",
        borderRadius: "14px",
        border:
          "1px solid color-mix(in srgb, var(--state-completed, #4ade80) 40%, transparent)",
        display: "grid",
        gap: "0.35rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "grid", gap: "0.15rem" }}>
          <span
            style={{
              fontSize: "var(--text-xs)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--state-completed, #4ade80)",
              fontWeight: 800,
            }}
          >
            Break
          </span>
          <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
            {formatTime(remaining)} remaining
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="End break"
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
          }}
        >
          End break
        </button>
      </div>
      <span
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        Step away on purpose, then come back to the next block instead of
        drifting into another tab.
      </span>
    </div>
  );
}

export { BREAK_STORAGE_KEY };
export default BreakTimerBanner;
