import { useState } from "react";

import type { Task } from "@shared/types";

import { primaryBtn } from "./ShutdownShared";

interface ShutdownWinStripProps {
  completedToday: Task[];
  onNext: (highlighted: Set<string>) => void;
}

export function ShutdownWinStrip({ completedToday, onNext }: ShutdownWinStripProps): JSX.Element {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const toggleWin = (id: string): void => {
    setHighlighted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0, marginBottom: "1.25rem" }}>
        What did you actually get done today?
      </p>
      {completedToday.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            borderRadius: "14px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border-subtle)",
            marginBottom: "1.5rem",
            display: "grid",
            gap: "0.35rem",
            textAlign: "center",
          }}
        >
          <strong style={{ fontSize: "var(--text-sm)" }}>Nothing logged today</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            That's okay — showing up still counts. The next block starts fresh.
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.4rem", marginBottom: "1.5rem" }}>
          {completedToday.map((task) => (
            <button
              key={task.id}
              onClick={() => toggleWin(task.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.65rem 0.85rem",
                borderRadius: "12px",
                border: "1px solid",
                borderColor: highlighted.has(task.id) ? "var(--accent)" : "var(--border-subtle)",
                background: highlighted.has(task.id) ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface-2)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <span
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "color-mix(in srgb, var(--state-ok, #10b981) 12%, transparent)",
                  color: "var(--state-ok, #10b981)",
                  fontSize: "0.75rem",
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span style={{ flex: 1, fontSize: "var(--text-sm)" }}>{task.title}</span>
              {highlighted.has(task.id) && (
                <span
                  style={{
                    padding: "0.18rem 0.42rem",
                    borderRadius: "999px",
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--accent)",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                  }}
                >
                  ★ win
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => onNext(highlighted)} style={{ ...primaryBtn, width: "100%" }}>
        Continue
      </button>
    </div>
  );
}
