import type { Notification } from "../../../shared/types";
import EmptyState from "../design-system/primitives/EmptyState";

export interface NotificationInboxProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onRead: (id: string) => void;
  onReadAll: () => void;
}

const LEVEL_COLORS: Record<Notification["level"], string> = {
  alarm: "var(--state-overdue)",
  habit: "var(--state-completed)",
  insight: "var(--accent)",
  system: "var(--text-secondary)",
  warn: "var(--state-warn)",
  info: "var(--accent)",
};

function relativeTime(value: string): string {
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function getLevelColor(level: Notification["level"] | undefined): string {
  if (!level) {
    return "var(--text-secondary)";
  }
  return LEVEL_COLORS[level] ?? "var(--text-secondary)";
}

export function NotificationInbox({
  open,
  onClose,
  notifications,
  onRead,
  onReadAll,
}: NotificationInboxProps): JSX.Element {
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <>
    <div
      aria-hidden={!open}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 199,
        background: "rgba(10, 12, 16, 0.28)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 0.22s ease",
      }}
    />
    <aside
      aria-hidden={!open}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "380px",
        maxWidth: "calc(100vw - 1rem)",
        zIndex: 200,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%), var(--surface))",
        borderLeft: "1px solid var(--border)",
        boxShadow: "-18px 0 36px rgba(0, 0, 0, 0.18)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.22s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "1rem 1rem 0.9rem",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "grid", gap: "0.15rem", marginRight: "auto" }}>
          <strong>Notifications</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            {notifications.length === 0
              ? "Alerts, reminders, and system updates in one inbox."
              : `${unreadCount} unread of ${notifications.length} total.`}
          </span>
        </div>
        <button
          onClick={onReadAll}
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
            padding: "0.45rem 0.7rem",
            borderRadius: "10px",
            fontWeight: 700,
          }}
        >
          Read all
        </button>
        <button
          onClick={onClose}
          aria-label="Close notifications"
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "0.95rem",
            lineHeight: 1,
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            fontWeight: 800,
          }}
        >
          X
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: "0.9rem", display: "grid", gap: "0.75rem" }}>
        {notifications.length === 0 ? (
          <EmptyState icon="IN" title="Inbox clear" subtitle="Nothing needs your attention right now." />
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => onRead(notification.id)}
              style={{
                display: "grid",
                gap: "0.45rem",
                textAlign: "left",
                padding: "0.95rem",
                borderRadius: "16px",
                border: "1px solid var(--border-subtle)",
                background: notification.read
                  ? "color-mix(in srgb, var(--surface) 94%, white 6%)"
                  : "linear-gradient(150deg, color-mix(in srgb, var(--surface-2) 84%, white 16%), var(--surface-2))",
                opacity: notification.read ? 0.76 : 1,
                cursor: "pointer",
                boxShadow: notification.read ? "none" : "var(--shadow-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  aria-hidden="true"
                  style={{
                    minWidth: "44px",
                    height: "24px",
                    borderRadius: "999px",
                    background: `${getLevelColor(notification.level)}16`,
                    color: getLevelColor(notification.level),
                    display: "grid",
                    placeItems: "center",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {(notification.level ?? "info").toUpperCase().slice(0, 4)}
                </span>
                <strong style={{ fontWeight: notification.read ? 500 : 600 }}>
                  {notification.title?.trim() || "Untitled notification"}
                </strong>
                <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  {relativeTime(notification.created_at)}
                </span>
              </div>
              {notification.body ? (
                <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.4 }}>
                  {notification.body}
                </span>
              ) : notification.action_url ? (
                <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.4 }}>
                  Action available for this alert.
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </aside>
    </>
  );
}

export default NotificationInbox;
