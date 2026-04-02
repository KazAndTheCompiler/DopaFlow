import type { MomentumScore } from "../../../../shared/types";

export interface MomentumCardProps {
  momentum?: MomentumScore | undefined;
  packyLine?: string | undefined;
}

export function MomentumCard({ momentum, packyLine }: MomentumCardProps): JSX.Element {
  const score = momentum?.score ?? 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const delta = momentum?.delta_vs_yesterday ?? 0;
  const deltaArrow = delta >= 0 ? "↑" : "↓";

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "92px 1fr",
        gap: "1rem",
        alignItems: "center",
        padding: "1rem",
        borderRadius: "20px",
        background: "var(--surface-2)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <svg width="92" height="92" viewBox="0 0 100 100" aria-label={`Momentum ${score}`}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" style={{ fill: "var(--text-primary)", fontSize: "1.2rem", fontWeight: 700 }}>
          {score}
        </text>
      </svg>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <strong>Momentum: {momentum?.level ?? "building"}</strong>
        <span style={{ color: delta >= 0 ? "var(--state-completed)" : "var(--state-overdue)" }}>
          {deltaArrow} {Math.abs(delta)} vs yesterday
        </span>
        <span style={{ color: "var(--text-secondary)" }}>
          {packyLine ?? momentum?.summary ?? "Packy will summarize your momentum here."}
        </span>
      </div>
    </section>
  );
}

export default MomentumCard;
