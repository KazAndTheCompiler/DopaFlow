import type { JSX } from "react";

import type { Task } from "@shared/types";

import { disabledBtn, ghostBtn, primaryBtn } from "./PlanMyDayShared";

export function CarryForward({
  overdue,
  decisions,
  yesterdayStats,
  onDecide,
  onNext,
  onBack,
}: {
  overdue: Task[];
  decisions: Record<string, "keep" | "postpone" | "drop">;
  yesterdayStats: { tasks: number; focusMin: number; streak: number };
  onDecide: (id: string, decision: "keep" | "postpone" | "drop") => void;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const allDecided = overdue.length === 0 || overdue.every((task) => decisions[task.id]);

  const statItems = [
    { label: "tasks completed", value: yesterdayStats.tasks },
    { label: "focus minutes", value: yesterdayStats.focusMin },
    { label: "day streak", value: yesterdayStats.streak },
  ].filter((stat) => stat.value > 0);

  return (
    <div>
      {statItems.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            padding: "0.65rem 0.9rem",
            borderRadius: "12px",
            background: "color-mix(in srgb, var(--state-ok, #10b981) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--state-ok, #10b981) 20%, transparent)",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, alignSelf: "center" }}>
            Yesterday
          </span>
          {statItems.map((stat) => (
            <span key={stat.label} style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text)" }}>
              {stat.value}
              <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-secondary)", marginLeft: "0.2rem" }}>
                {stat.label}
              </span>
            </span>
          ))}
        </div>
      )}

      {overdue.length === 0 ? (
        <div style={{ textAlign: "center", padding: "0.75rem 0 1.25rem" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              margin: "0 auto 0.55rem",
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              background: "color-mix(in srgb, var(--state-ok, #10b981) 12%, transparent)",
              color: "var(--state-ok, #10b981)",
              fontSize: "1.2rem",
            }}
          >
            ✓
          </div>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "var(--text-sm)" }}>
            Clean slate. No carryover from yesterday.
          </p>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
            These didn't get done. Decide before you plan today.
          </p>
          <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
            {overdue.map((task) => {
              const decision = decisions[task.id];
              return (
                <div
                  key={task.id}
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: "12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-subtle)",
                    display: "grid",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{task.title}</span>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {(["keep", "postpone", "drop"] as const).map((action) => (
                      <button
                        key={action}
                        onClick={() => onDecide(task.id, action)}
                        style={{
                          padding: "0.3rem 0.65rem",
                          borderRadius: "8px",
                          border: "1.5px solid",
                          borderColor: decision === action ? "var(--accent)" : "var(--border-subtle)",
                          background: decision === action ? "var(--accent)" : "transparent",
                          color: decision === action ? "var(--text-inverted)" : "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {action === "keep" ? "Keep today" : action === "postpone" ? "Tomorrow" : "Drop"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={onBack} style={ghostBtn}>
          Back
        </button>
        <button onClick={onNext} disabled={!allDecided} style={{ ...(allDecided ? primaryBtn : disabledBtn), flex: 1 }}>
          Continue
        </button>
      </div>
    </div>
  );
}
