import type { FocusSession } from "../../../../shared/types";

const STATUS_COLORS: Record<string, string> = {
  completed: "var(--state-completed)",
  running: "var(--accent)",
  paused: "var(--state-warn)",
  incomplete: "var(--border-subtle)",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Done",
  running: "Active",
  paused: "Paused",
  incomplete: "Stopped",
};

function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function SessionHistory({ sessions }: { sessions: FocusSession[] }): JSX.Element {
  const todayCompleted = sessions.filter(
    (s) => s.status === "completed" && isToday(s.started_at),
  );
  const totalMinutesToday = todayCompleted.reduce((sum, s) => sum + s.duration_minutes, 0);

  // Show up to 20 recent sessions, excluding the actively running one from history
  const recent = sessions.filter((s) => s.status !== "running").slice(0, 20);

  return (
    <section
      style={{
        padding: "1.1rem 1.15rem",
        background: "var(--surface)",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.85rem",
        alignContent: "start",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Session History</strong>
        {totalMinutesToday > 0 && (
          <span
            style={{
              padding: "0.15rem 0.55rem",
              borderRadius: "999px",
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--accent)",
              marginLeft: "auto",
            }}
          >
            {totalMinutesToday}m today
          </span>
        )}
      </div>

      {recent.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            borderRadius: "14px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border-subtle)",
            textAlign: "center",
            display: "grid",
            gap: "0.35rem",
          }}
        >
          <strong style={{ fontSize: "var(--text-sm)" }}>No sessions yet</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            Start a focus block to get on the board.
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {recent.map((session) => {
            const startDate = new Date(session.started_at);
            const sameDay = isToday(session.started_at);
            const dateLabel = sameDay
              ? startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : startDate.toLocaleDateString([], { month: "short", day: "numeric" }) +
                " " +
                startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const statusColor = STATUS_COLORS[session.status] ?? "var(--text-secondary)";
            return (
              <div
                key={session.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "12px",
                  background: "var(--surface-2)",
                  border: session.status === "completed"
                    ? "1px solid color-mix(in srgb, var(--state-completed) 15%, transparent)"
                    : "1px solid transparent",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: statusColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", flexShrink: 0 }}>
                  {dateLabel}
                </span>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, flex: 1 }}>
                  {session.duration_minutes}m
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: statusColor,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    background: `${statusColor}18`,
                  }}
                >
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SessionHistory;
