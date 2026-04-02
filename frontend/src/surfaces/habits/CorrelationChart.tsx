import type { CorrelationInsight } from "@api/insights";

function correlationBar(r: number): JSX.Element {
  const width = Math.abs(r) * 100;
  const color = r >= 0 ? "var(--state-completed)" : "var(--state-overdue)";
  return (
    <div
      style={{
        height: "6px",
        width: "100%",
        background: "var(--border-subtle)",
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

export function CorrelationChart({ insights }: { insights: CorrelationInsight[] }): JSX.Element {
  if (insights.length === 0) {
    return (
      <section
        style={{
          padding: "1.25rem",
          background: "var(--surface-2)",
          borderRadius: "18px",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
        }}
      >
        Pearson correlations — not enough data yet. Keep logging habits and moods.
      </section>
    );
  }

  return (
    <section
      style={{
        padding: "1.25rem",
        background: "var(--surface-2)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.75rem",
      }}
    >
      <strong>Habit Correlations (r)</strong>
      {insights.map((insight) => (
        <div key={insight.metric} style={{ display: "grid", gap: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
            <span style={{ color: "var(--text-primary)" }}>{insight.metric}</span>
            {insight.pearson_r !== undefined && (
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  color: insight.pearson_r >= 0 ? "var(--state-completed)" : "var(--state-overdue)",
                  fontWeight: 600,
                }}
              >
                {insight.pearson_r >= 0 ? "+" : ""}{insight.pearson_r.toFixed(2)}
              </span>
            )}
          </div>
          {insight.pearson_r !== undefined && correlationBar(insight.pearson_r)}
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{insight.interpretation}</span>
        </div>
      ))}
    </section>
  );
}

export default CorrelationChart;
