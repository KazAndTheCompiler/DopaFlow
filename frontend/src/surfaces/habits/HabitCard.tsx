import { useState } from "react";
import type { Habit } from "../../../../shared/types";
import { freezeHabit, unfreezeHabit } from "@api/habits";

export interface HabitCardProps {
  habit: Habit;
  onCheckIn?: ((id: string) => void) | undefined;
  onRefresh?: (() => void) | undefined;
}

export function HabitCard({ habit, onCheckIn, onRefresh }: HabitCardProps): JSX.Element {
  const isFrozen = habit.freeze_until ? new Date(habit.freeze_until) > new Date() : false;
  const [isHovered, setIsHovered] = useState(false);
  const [showFreezeMenu, setShowFreezeMenu] = useState(false);

  // Progress ring dimensions and calculations
  const ringRadius = 16;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const completionPct = habit.completion_pct ?? 0;
  const ringVisualPct = Math.min(completionPct, 100);
  const ringDashOffset = ringCircumference - (ringVisualPct / 100) * ringCircumference;

  // Determine ring color based on completion percentage
  let ringColor = "var(--state-warn)"; // < 50%
  if (completionPct >= 100) {
    ringColor = "var(--state-completed)";
  } else if (completionPct >= 50) {
    ringColor = "var(--accent)";
  }

  return (
    <article
      style={{
        padding: "1rem",
        borderRadius: "18px",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "var(--surface-glass-blur, blur(14px))",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.5rem",
        boxShadow: isHovered ? "var(--shadow-elevated)" : "none",
        transform: isHovered ? "translateY(-1px)" : "none",
        transition: "box-shadow 180ms ease, transform 180ms ease",
        position: "relative",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            display: "inline-block",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: isFrozen ? "var(--border-subtle)" : habit.color ?? "var(--accent)",
            flexShrink: 0,
          }}
        />
        <strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {habit.name}
        </strong>
        {/* Progress ring */}
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ flexShrink: 0 }} aria-label={`${completionPct}% complete`}>
          <circle cx="18" cy="18" r={ringRadius} fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
          <circle
            cx="18"
            cy="18"
            r={ringRadius}
            fill="none"
            stroke={ringColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringDashOffset}
            transform="rotate(-90 18 18)"
          />
          <text x="18" y="20" textAnchor="middle" style={{ fill: "var(--text-secondary)", fontSize: "10px", fontWeight: 600 }}>
            {Math.floor(completionPct)}%
          </text>
        </svg>
        {!isFrozen && onCheckIn && (
          <button
            onClick={() => onCheckIn(habit.id)}
            aria-label={`Check in ${habit.name}`}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "1.5px solid var(--accent)",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            OK
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        <span
          style={{
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
            background: "var(--surface-2)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          ST {habit.current_streak}d
        </span>
        <span
          style={{
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
            background: "var(--surface-2)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          {habit.target_freq}/ {habit.target_period}
        </span>
        <span
          style={{
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
            background: completionPct > 100 ? "color-mix(in srgb, var(--state-warn) 16%, var(--surface-2))" : "var(--surface-2)",
            fontSize: "var(--text-sm)",
            color: completionPct > 100 ? "var(--state-warn)" : "var(--text-secondary)",
          }}
        >
          {habit.completion_count ?? 0} hit{(habit.completion_count ?? 0) === 1 ? "" : "s"}
        </span>
        {isFrozen ? (
          <button
            onClick={() => void unfreezeHabit(habit.id).then(() => onRefresh?.())}
            style={{ padding: "0.15rem 0.5rem", borderRadius: "999px", background: "var(--surface-2)", fontSize: "var(--text-sm)", color: "var(--accent)", border: "none", cursor: "pointer" }}
          >
            FR frozen · unfreeze
          </button>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowFreezeMenu((v) => !v)}
              title="Freeze streak"
              style={{ padding: "0.15rem 0.5rem", borderRadius: "999px", background: "transparent", fontSize: "var(--text-sm)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}
            >
              FR
            </button>
            {showFreezeMenu && (
              <div
                style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "0.35rem", display: "grid", gap: "0.2rem", zIndex: 10, minWidth: "110px", boxShadow: "var(--shadow-elevated)" }}
              >
                {[1, 3, 7, 14].map((days) => (
                  <button
                    key={days}
                    onClick={() => void freezeHabit(habit.id, days).then(() => { setShowFreezeMenu(false); onRefresh?.(); })}
                    style={{ padding: "0.3rem 0.6rem", borderRadius: "6px", border: "none", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: "var(--text-sm)", textAlign: "left" }}
                  >
                    {days === 1 ? "1 day" : `${days} days`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default HabitCard;
