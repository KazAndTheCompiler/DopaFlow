import { useEffect, useRef, useState } from "react";

import type { FocusSession } from "../../../../shared/types";

interface FocusTimerProps {
  session?: FocusSession | undefined;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
}

const RING_R = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function FocusTimer({ session, onPause, onResume, onComplete }: FocusTimerProps): JSX.Element {
  const totalSeconds = (session?.duration_minutes ?? 25) * 60;
  const [elapsed, setElapsed] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep onComplete in a ref so the interval closure is never stale
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isRunning = session?.status === "running";
  const isPaused = session?.status === "paused";

  const pausedSeconds = Math.floor((session?.paused_duration_ms ?? 0) / 1000);

  // When a session starts or changes, restore elapsed from started_at so
  // re-mounting mid-session shows the correct remaining time instead of 0:00.
  useEffect(() => {
    if (session?.started_at && session.status === "running") {
      const serverStart = new Date(session.started_at).getTime();
      const wallElapsed = Math.floor((Date.now() - serverStart) / 1000);
      const alreadyElapsed = Math.max(0, wallElapsed - pausedSeconds);
      setElapsed(Math.min(alreadyElapsed, totalSeconds));
    } else {
      setElapsed(0);
    }
  }, [session?.id, session?.status, session?.started_at, session?.paused_duration_ms]);

  // Use Date.now() comparisons on each tick to avoid drift under tab throttling.
  useEffect(() => {
    if (isRunning) {
      const startedAt = session?.started_at
        ? new Date(session.started_at).getTime()
        : Date.now() - elapsed * 1000;

      intervalRef.current = setInterval(() => {
        const wallElapsed = Math.floor((Date.now() - startedAt) / 1000);
        const newElapsed = Math.max(0, wallElapsed - pausedSeconds);
        if (newElapsed >= totalSeconds) {
          clearInterval(intervalRef.current!);
          setElapsed(totalSeconds);
          onCompleteRef.current();
        } else {
          setElapsed(newElapsed);
        }
      }, 500);
    } else {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [isRunning, totalSeconds, pausedSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = Math.max(0, totalSeconds - elapsed);
  const progress = elapsed / totalSeconds;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  const levelColor =
    progress < 0.4 ? "var(--accent)" : progress < 0.75 ? "var(--state-warn)" : "var(--state-completed)";

  if (!session) {
    return (
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "2.5rem 1rem",
          background: "linear-gradient(155deg, color-mix(in srgb, var(--surface) 88%, white 12%), var(--surface))",
          borderRadius: "20px",
          border: "1px solid var(--border-subtle)",
          gap: "0.75rem",
          color: "var(--text-secondary)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <svg width={200} height={200} viewBox="0 0 200 200" aria-hidden="true">
          <circle cx={100} cy={100} r={RING_R} fill="none" stroke="var(--border-subtle)" strokeWidth={10} />
        </svg>
        <strong style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>No active session</strong>
        <span style={{ fontSize: "var(--text-sm)" }}>Start a block from the panel above to turn intent into a protected timer.</span>
      </section>
    );
  }

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem 1rem",
        background: "linear-gradient(155deg, color-mix(in srgb, var(--surface) 88%, white 12%), var(--surface))",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
        gap: "1rem",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "grid", gap: "0.18rem", textAlign: "center" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Active timer</strong>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Stay inside this block until you pause, finish, or deliberately stop.
        </span>
      </div>
      {/* Timer ring with time overlay using a relative container */}
      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          style={{ transform: "rotate(-90deg)" }}
          aria-hidden="true"
        >
          <circle cx={100} cy={100} r={RING_R} fill="none" stroke="var(--border-subtle)" strokeWidth={10} />
          <circle
            cx={100}
            cy={100}
            r={RING_R}
            fill="none"
            stroke={levelColor}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.5s" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
          aria-live="off"
        >
          <span
            style={{ fontSize: "2.8rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}
          >
            {formatTime(remaining)}
          </span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {session.duration_minutes}m · {isPaused ? "paused" : "running"}
          </span>
        </div>
      </div>

      {/* Visually hidden live region for screen readers */}
      <span
        role="timer"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}
      >
        {formatTime(remaining)} remaining
      </span>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        {isRunning && (
          <button
            onClick={onPause}
            aria-label="Pause focus session"
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "10px",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            Pause
          </button>
        )}
        {isPaused && (
          <button
            onClick={onResume}
            aria-label="Resume focus session"
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "10px",
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              cursor: "pointer",
              color: "var(--text-inverted)",
              fontWeight: 600,
            }}
          >
            Resume
          </button>
        )}
        {/* Complete is only shown when paused or when time runs out, not alongside Pause */}
        {(isPaused || remaining === 0) && (
          <button
            onClick={onComplete}
            aria-label="Mark focus session complete"
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "10px",
              border: "1px solid var(--state-completed)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--state-completed)",
            }}
          >
            Complete
          </button>
        )}
      </div>
    </section>
  );
}

export default FocusTimer;
