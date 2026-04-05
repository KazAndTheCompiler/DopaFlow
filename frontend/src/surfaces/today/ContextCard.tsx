import type { CorrelationInsight, WeeklyDigest } from "@api/insights";
import { Skeleton } from "@ds/primitives/Skeleton";

export interface ContextCardProps {
  weeklyDigest?: WeeklyDigest | undefined;
  correlations: CorrelationInsight[];
}

export function ContextCard({ weeklyDigest, correlations }: ContextCardProps): JSX.Element {
  const visibleCorrelations = correlations.slice(0, 3);

  return (
    <section
      style={{
        padding: "1.1rem 1.15rem",
        borderRadius: "20px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "1rem",
      }}
    >
      {/* Weekly digest */}
      <div style={{ display: "grid", gap: "0.55rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>
          {weeklyDigest?.title ?? "This week"}
        </strong>
        {weeklyDigest?.highlights?.length ? (
          <div style={{ display: "grid", gap: "0.3rem" }}>
            {weeklyDigest.highlights.map((highlight) => (
              <div
                key={highlight}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "baseline",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: "var(--accent)", flexShrink: 0, fontSize: "var(--text-xs)" }}>◆</span>
                <span>{highlight}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <Skeleton width="88%" height="13px" />
            <Skeleton width="92%" height="13px" />
            <Skeleton width="76%" height="13px" />
          </div>
        )}
      </div>

      {/* Trends */}
      {visibleCorrelations.length > 0 && (
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            Trends
          </span>
          {visibleCorrelations.map((correlation) => {
            const value = Number(correlation.pearson_r ?? 0);
            const positive = value >= 0;
            const color = positive ? "var(--state-completed)" : "var(--state-overdue)";
            return (
              <div key={correlation.metric} style={{ display: "grid", gap: "0.3rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{correlation.metric}</span>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color }}>
                    {positive ? "+" : "−"}{Math.round(Math.abs(value) * 100)}%
                  </span>
                </div>
                <div style={{ width: "100%", height: "4px", borderRadius: "999px", background: "var(--surface-2)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.abs(value) * 100}%`,
                      height: "100%",
                      background: color,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                {correlation.interpretation && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    {correlation.interpretation}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!visibleCorrelations.length && !weeklyDigest?.highlights?.length && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          Trends appear after a few days of habit and task data.
        </span>
      )}
    </section>
  );
}

export default ContextCard;
