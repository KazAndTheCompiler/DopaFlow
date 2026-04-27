import type { Task } from "@shared/types";

import { primaryBtn, secondaryBtn } from "./ShutdownShared";

interface ShutdownDeferStepProps {
  incompleteToday: Task[];
  decisions: Record<string, "tomorrow" | "this_week" | "drop">;
  onDecide: (taskId: string, when: "tomorrow" | "this_week" | "drop") => void;
  onNext: () => void;
  onBack: () => void;
}

export function ShutdownDeferStep({
  incompleteToday,
  decisions,
  onDecide,
  onNext,
  onBack,
}: ShutdownDeferStepProps): JSX.Element {
  return (
    <div>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
          marginTop: 0,
          marginBottom: "1.25rem",
        }}
      >
        What didn't get done?
      </p>
      {incompleteToday.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            borderRadius: "14px",
            background:
              "color-mix(in srgb, var(--state-completed) 6%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--state-completed) 20%, transparent)",
            marginBottom: "1.5rem",
            display: "grid",
            gap: "0.35rem",
            textAlign: "center",
          }}
        >
          <strong
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--state-completed)",
            }}
          >
            Clean close
          </strong>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Nothing left hanging. Tomorrow starts with a clear runway.
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {incompleteToday.map((task) => {
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
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {task.title}
                </span>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {(["tomorrow", "this_week", "drop"] as const).map(
                    (action) => (
                      <button
                        key={action}
                        onClick={() => onDecide(task.id, action)}
                        style={{
                          padding: "0.3rem 0.65rem",
                          borderRadius: "8px",
                          border: "1.5px solid",
                          borderColor:
                            decision === action
                              ? "var(--accent)"
                              : "var(--border-subtle)",
                          background:
                            decision === action
                              ? "var(--accent)"
                              : "transparent",
                          color:
                            decision === action
                              ? "var(--text-inverted)"
                              : "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {action === "tomorrow"
                          ? "Tomorrow"
                          : action === "this_week"
                            ? "This week"
                            : "Drop"}
                      </button>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={onBack} style={secondaryBtn}>
          Back
        </button>
        <button
          onClick={onNext}
          style={{
            flex: 1,
            ...primaryBtn,
            background: primaryBtn.background,
            color: "var(--text-inverted)",
            cursor: "pointer",
            opacity: 1,
            boxShadow: "var(--shadow-soft)",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
