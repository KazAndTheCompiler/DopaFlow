interface GoogleSyncBadgeProps {
  status: string;
  onSync: () => Promise<void> | void;
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "var(--state-completed)",
  attention: "var(--state-warn)",
  error: "var(--state-overdue)",
  idle: "var(--text-secondary)",
};

export function GoogleSyncBadge({
  status,
  onSync,
}: GoogleSyncBadgeProps): JSX.Element {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const label =
    status === "healthy"
      ? "healthy"
      : status === "attention"
        ? "needs review"
        : status === "error"
          ? "error"
          : "idle";
  const title =
    status === "healthy"
      ? "Google sync looks healthy."
      : status === "attention"
        ? "Google sync needs review. Check conflict or stale-state indicators in the calendar."
        : status === "error"
          ? "Google sync reported an error. Retry only after checking the calendar status."
          : "Google sync is idle.";

  return (
    <button
      onClick={() => void onSync()}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.4rem 0.85rem",
        borderRadius: "999px",
        border: `1px solid ${color}`,
        background: "transparent",
        cursor: "pointer",
        color: "var(--text-primary)",
        fontSize: "var(--text-sm)",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      Google · {label}
    </button>
  );
}

export default GoogleSyncBadge;
