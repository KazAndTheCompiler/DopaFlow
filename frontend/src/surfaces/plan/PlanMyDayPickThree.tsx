import type { JSX } from "react";

import type { Task } from "@shared/types";

import { ghostBtn, MAX_PICKS, primaryBtn } from "./PlanMyDayShared";

export function PickThree({
  pending,
  picks,
  todayEvents,
  onToggle,
  onNext,
  onBack,
}: {
  pending: Task[];
  picks: Set<string>;
  todayEvents: Array<{ title: string; start_at: string }>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const priorityDot: Record<number, string> = {
    1: "var(--state-overdue)",
    2: "var(--state-warn)",
    3: "var(--accent)",
    4: "var(--text-secondary)",
    5: "var(--border)",
  };

  const fmtTime = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div>
      {todayEvents.length > 0 && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "10px",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "0.85rem",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>TODAY</span>
          {todayEvents.slice(0, 4).map((event, index) => (
            <span
              key={index}
              style={{
                fontSize: "11px",
                color: "var(--text)",
                background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                borderRadius: "6px",
                padding: "0.15rem 0.45rem",
              }}
            >
              {fmtTime(event.start_at)} {event.title}
            </span>
          ))}
          {todayEvents.length > 4 && (
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              +{todayEvents.length - 4} more
            </span>
          )}
        </div>
      )}

      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
        Pick up to {MAX_PICKS}. These are your commitments.
      </p>

      <div
        style={{
          display: "grid",
          gap: "0.4rem",
          maxHeight: "280px",
          overflowY: "auto",
          marginBottom: "1.25rem",
          paddingRight: "0.25rem",
        }}
      >
        {pending.length === 0 && (
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", textAlign: "center", padding: "1rem 0" }}>
            Nothing to pick — you're done.
          </p>
        )}
        {pending.map((task) => {
          const selected = picks.has(task.id);
          const atMax = picks.size >= MAX_PICKS && !selected;

          return (
            <button
              key={task.id}
              onClick={() => !atMax && onToggle(task.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.6rem 0.85rem",
                borderRadius: "12px",
                border: "1.5px solid",
                borderColor: selected ? "var(--accent)" : "var(--border-subtle)",
                background: selected ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface-2)",
                cursor: atMax ? "not-allowed" : "pointer",
                opacity: atMax ? 0.4 : 1,
                textAlign: "left",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: priorityDot[task.priority] ?? "var(--border)",
                }}
              />
              <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: selected ? 600 : 400 }}>
                {task.title}
              </span>
              {task.estimated_minutes != null && (
                <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{task.estimated_minutes}m</span>
              )}
              {selected && <span style={{ fontSize: "0.8rem", color: "var(--accent)" }}>✓</span>}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button onClick={onBack} style={ghostBtn}>
          Back
        </button>
        <span style={{ flex: 1, fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
          {picks.size}/{MAX_PICKS} picked
        </span>
        <button onClick={onNext} style={primaryBtn}>
          Continue
        </button>
      </div>
    </div>
  );
}
