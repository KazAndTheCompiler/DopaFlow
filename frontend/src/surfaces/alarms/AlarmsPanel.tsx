interface AlarmsPanelProps {
  running: boolean;
  nextAlarmAt?: string | null | undefined;
  alarmCount: number;
}

function formatNext(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) {
 return "overdue";
}
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 60) {
 return `in ${diffMins}m`;
}
  const diffHrs = Math.round(diffMins / 60);
  if (diffHrs < 24) {
 return `in ${diffHrs}h`;
}
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AlarmsPanel({ running, nextAlarmAt, alarmCount }: AlarmsPanelProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.25rem",
        padding: "0.65rem 1rem",
        background: "var(--surface-2)",
        borderRadius: "12px",
        border: "1px solid var(--border-subtle)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: running ? "var(--state-completed)" : "var(--text-secondary)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          Scheduler {running ? "running" : "idle"}
        </span>
      </div>

      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
        {alarmCount} alarm{alarmCount !== 1 ? "s" : ""}
      </div>

      {nextAlarmAt && (
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
          Next: <strong>{formatNext(nextAlarmAt)}</strong>
        </div>
      )}
    </div>
  );
}

export default AlarmsPanel;
