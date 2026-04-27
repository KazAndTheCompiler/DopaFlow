import type { JSX } from "react";

import type { PeerFeed } from "../../../../shared/types";

export type CalendarTab = "week" | "day" | "month" | "kanban" | "eisenhower";

export function describeFeedRepair(raw: string | null): {
  title: string;
  detail: string;
} {
  switch (raw) {
    case "token_invalid_or_revoked":
      return {
        title: "Reconnect with a fresh setup code",
        detail:
          "The other install no longer accepts this token, so mirrored events may be stale until the feed is reconnected.",
      };
    case "redirect_not_allowed":
      return {
        title: "Fix the saved base URL",
        detail:
          "This feed is pointing through a redirect. Use the direct DopaFlow API base URL from the other install before trusting it again.",
      };
    case "invalid_feed_payload":
      return {
        title: "The remote URL is not returning a valid calendar feed",
        detail:
          "It is likely pointed at the wrong place. Confirm the saved URL ends in the other install's /api/v2 path.",
      };
    default:
      if (raw && /^HTTP 404$/i.test(raw)) {
        return {
          title: "Feed endpoint not found",
          detail:
            "The saved base URL looks wrong or incomplete, so this mirror needs its connection details checked.",
        };
      }
      if (raw && /^HTTP 5\d\d$/i.test(raw)) {
        return {
          title: "The remote install is temporarily unavailable",
          detail:
            "Retry sync after the other app comes back. Until then, rely on local events carefully.",
        };
      }
      return {
        title: "Mirror needs attention",
        detail:
          "Open sharing settings, retry the feed, and replace the setup code if the problem repeats.",
      };
  }
}

export function formatSyncAge(iso: string | null): string {
  if (!iso) {
    return "Not synced yet";
  }
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) {
    const minutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${minutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const days = Math.floor(diffHours / 24);
  return `${days}d ago`;
}

export function CalendarTabButton({
  id,
  label,
  activeTab,
  onSelect,
}: {
  id: CalendarTab;
  label: string;
  activeTab: CalendarTab;
  onSelect: (tab: CalendarTab) => void;
}): JSX.Element {
  return (
    <button
      onClick={() => onSelect(id)}
      style={{
        padding: "0.52rem 0.95rem",
        borderRadius: "12px",
        border: "1px solid",
        borderColor:
          activeTab === id ? "var(--accent)" : "var(--border-subtle)",
        background:
          activeTab === id
            ? "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))"
            : "color-mix(in srgb, var(--surface) 76%, white 24%)",
        color:
          activeTab === id ? "var(--text-inverted)" : "var(--text-secondary)",
        cursor: "pointer",
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        boxShadow: activeTab === id ? "var(--shadow-soft)" : "none",
        transition:
          "transform 160ms ease, border-color 160ms ease, opacity 160ms ease",
      }}
    >
      {label}
    </button>
  );
}

export function CalendarNavButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.5rem 0.9rem",
        borderRadius: "12px",
        border: "1px solid var(--border-subtle)",
        background: "color-mix(in srgb, var(--surface) 76%, white 24%)",
        cursor: "pointer",
        color: "var(--text-primary)",
        fontWeight: 700,
        transition: "transform 160ms ease, border-color 160ms ease",
      }}
    >
      {label}
    </button>
  );
}

export function CalendarSharedFeedsPanel({
  peerFeeds,
  filteredEventsCount,
  sharedEvents,
  hiddenSources,
  sourceMeta,
  events,
  staleFeeds,
  allSharedSourcesHidden,
  visibleSharedEvents,
  onToggleSource,
}: {
  peerFeeds: Array<{
    id: string;
    label?: string;
    color: string;
    sync_status: "idle" | "syncing" | "ok" | "error" | "pending";
    last_synced_at?: string | null;
    last_error?: string | null;
  }>;
  filteredEventsCount: number;
  sharedEvents: number;
  hiddenSources: string[];
  sourceMeta: Array<{
    id: string;
    label?: string;
    color: string;
    readonly: boolean;
  }>;
  events: Array<{ source_type?: string | null }>;
  staleFeeds: Array<{
    id: string;
    label?: string;
    color: string;
    sync_status: "idle" | "syncing" | "ok" | "error" | "pending";
    last_synced_at?: string | null;
    last_error?: string | null;
  }>;
  allSharedSourcesHidden: boolean;
  visibleSharedEvents: number;
  onToggleSource: (sourceId: string) => void;
}): JSX.Element {
  return (
    <section
      style={{
        display: "grid",
        gap: "0.8rem",
        padding: "1rem",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        background:
          "linear-gradient(160deg, color-mix(in srgb, var(--surface) 82%, white 18%), var(--surface))",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <strong style={{ fontSize: "var(--text-base)" }}>
            Shared calendars are live in this view
          </strong>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
            }}
          >
            Mirror feeds stay read-only here so future user-to-user sharing can
            add permissions cleanly instead of rewriting the model later.
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "0.35rem 0.65rem",
              borderRadius: "999px",
              background: "var(--surface-2)",
              fontSize: "var(--text-sm)",
            }}
          >
            {filteredEventsCount} visible events
          </span>
          <span
            style={{
              padding: "0.35rem 0.65rem",
              borderRadius: "999px",
              background: "var(--surface-2)",
              fontSize: "var(--text-sm)",
            }}
          >
            {sharedEvents} shared
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
        {sourceMeta.map((source) => {
          const hidden = hiddenSources.includes(source.id);
          const count = events.filter((event) => {
            const sourceId = event.source_type?.startsWith("peer:")
              ? event.source_type.slice("peer:".length)
              : "local";
            return sourceId === source.id;
          }).length;

          return (
            <button
              key={source.id}
              onClick={() => onToggleSource(source.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.45rem 0.8rem",
                borderRadius: "999px",
                border: `1px solid ${hidden ? "var(--border-subtle)" : source.color}`,
                background: hidden
                  ? "transparent"
                  : "color-mix(in srgb, var(--surface) 82%, white 18%)",
                color: "var(--text-primary)",
                cursor: "pointer",
                opacity: hidden ? 0.58 : 1,
              }}
              title={hidden ? `Show ${source.label}` : `Hide ${source.label}`}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: source.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                {source.label}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {peerFeeds.map((feed) => {
          const isStale = staleFeeds.some(
            (candidate) => candidate.id === feed.id,
          );
          const repair = describeFeedRepair(feed.last_error);
          const tone =
            feed.sync_status === "error"
              ? "var(--state-overdue)"
              : feed.sync_status === "syncing"
                ? "var(--accent)"
                : isStale
                  ? "var(--state-warn)"
                  : "var(--state-ok)";
          const statusLabel =
            feed.sync_status === "error"
              ? "Needs attention"
              : feed.sync_status === "syncing"
                ? "Syncing"
                : isStale
                  ? "Stale"
                  : feed.sync_status === "ok"
                    ? "Healthy"
                    : "Idle";

          return (
            <div
              key={feed.id}
              style={{
                padding: "0.9rem 1rem",
                borderRadius: "16px",
                border: `1px solid color-mix(in srgb, ${tone} 28%, var(--border-subtle))`,
                background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 8%, var(--surface)), var(--surface))`,
                display: "grid",
                gap: "0.45rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  alignItems: "start",
                }}
              >
                <div style={{ display: "grid", gap: "0.18rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "999px",
                        background: feed.color,
                        flexShrink: 0,
                      }}
                    />
                    <strong>{feed.label}</strong>
                  </div>
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
                <span
                  style={{
                    padding: "0.22rem 0.58rem",
                    borderRadius: "999px",
                    background: `color-mix(in srgb, ${tone} 14%, transparent)`,
                    color: tone,
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                  }}
                >
                  {feed.sync_status}
                </span>
              </div>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                Last successful sync: {formatSyncAge(feed.last_synced_at)}
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: feed.last_error
                    ? "var(--state-overdue)"
                    : "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {feed.last_error
                  ? `${repair.title}. ${repair.detail}`
                  : isStale
                    ? "This mirror is connected but older than expected. Run sync again before relying on it."
                    : "No recent sync error reported."}
              </span>
            </div>
          );
        })}
      </div>
      {allSharedSourcesHidden && (
        <div
          style={{
            padding: "0.85rem 0.95rem",
            borderRadius: "14px",
            border: "1px dashed var(--border-subtle)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            lineHeight: 1.5,
          }}
        >
          All shared calendars are hidden right now. Re-enable a source chip
          above to see mirrored events again.
        </div>
      )}
      {!allSharedSourcesHidden &&
        sharedEvents > 0 &&
        visibleSharedEvents === 0 && (
          <div
            style={{
              padding: "0.85rem 0.95rem",
              borderRadius: "14px",
              border: "1px dashed var(--border-subtle)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              lineHeight: 1.5,
            }}
          >
            Shared calendars are connected, but there are no mirrored events in
            the visible range for this view.
          </div>
        )}
    </section>
  );
}
