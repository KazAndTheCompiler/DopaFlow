import type { JSX, ReactNode } from "react";

export function PlanMyDayFrame({
  stepTitle,
  onClose,
  children,
}: {
  stepTitle: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Plan my day"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 10, 14, 0.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%), var(--surface))",
          borderRadius: "28px",
          padding: "1.2rem 1.25rem 1.35rem",
          boxShadow: "var(--shadow-floating)",
          border: "1px solid var(--border-subtle)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: "grid",
            gap: "0.95rem",
            padding: "0.45rem 0.35rem 1rem",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 800,
                }}
              >
                Daily ritual
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: "clamp(1.25rem, 2vw, 1.6rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                Plan my day
              </h2>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{stepTitle}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 800,
                lineHeight: 1,
                width: "36px",
                height: "36px",
                borderRadius: "12px",
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              padding: "0.8rem 0.9rem",
              borderRadius: "16px",
              background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Set your energy, clear yesterday’s leftovers, choose the real commitments, then start the day with intention.
            </span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
