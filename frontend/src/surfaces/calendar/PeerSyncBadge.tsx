interface PeerSyncBadgeProps {
  feeds: Array<{ id: string; label: string; sync_status: string; color: string; last_synced_at?: string | null; last_error?: string | null }>;
  onSync: () => Promise<void> | void;
}

const STATUS_COLORS: Record<string, string> = {
  ok: "var(--state-completed)",
  error: "var(--state-overdue)",
  syncing: "var(--accent)",
  idle: "var(--text-secondary)",
};

function getWorstStatus(statuses: string[]): string {
  const order = ["error", "syncing", "idle", "ok"];
  for (const status of order) {
    if (statuses.includes(status)) {
 return status;
}
  }
  return "idle";
}

export function PeerSyncBadge({ feeds, onSync }: PeerSyncBadgeProps): JSX.Element {
  if (feeds.length === 0) {
    return <></>;
  }

  const isSingle = feeds.length === 1;
  const feed = feeds[0];
  const status = isSingle ? feed.sync_status : getWorstStatus(feeds.map((f) => f.sync_status));
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  const dotColor = isSingle ? feed.color : statusColor;

  const worstStatus = isSingle ? feed.sync_status : getWorstStatus(feeds.map((f) => f.sync_status));
  const displayStatus = isSingle ? feed.sync_status : worstStatus;
  const staleFeeds = feeds.filter((candidate) => {
    if (!candidate.last_synced_at) {
      return candidate.sync_status !== "syncing";
    }
    return Date.now() - new Date(candidate.last_synced_at).getTime() > 36 * 60 * 60 * 1000;
  });
  const erroredFeeds = feeds.filter((candidate) => candidate.sync_status === "error");
  const summaryLabel = isSingle
    ? erroredFeeds.length > 0
      ? "repair needed"
      : staleFeeds.length > 0
        ? "stale"
        : displayStatus
    : erroredFeeds.length > 0
      ? `${erroredFeeds.length} need repair`
      : staleFeeds.length > 0
        ? `${staleFeeds.length} stale`
        : displayStatus;
  const title = isSingle
    ? erroredFeeds.length > 0
      ? `${feed.label} failed to sync. Open shared calendar health below or retry sync.`
      : staleFeeds.length > 0
        ? `${feed.label} has not synced recently. Retry before relying on it.`
        : `${feed.label} is healthy.`
    : erroredFeeds.length > 0
      ? `${erroredFeeds.length} peer feed${erroredFeeds.length === 1 ? "" : "s"} need repair.`
      : staleFeeds.length > 0
        ? `${staleFeeds.length} peer feed${staleFeeds.length === 1 ? "" : "s"} may be stale.`
        : "All peer feeds look healthy.";

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
        border: `1px solid ${statusColor}`,
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
          background: dotColor,
          flexShrink: 0,
        }}
      />
      {isSingle ? (
        <>
          {feed.label} · {summaryLabel}
        </>
      ) : (
        <>
          {feeds.length} peers · {summaryLabel}
        </>
      )}
    </button>
  );
}

export default PeerSyncBadge;
