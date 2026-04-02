import { useContext, useMemo, useState } from "react";

import { AppDataContext } from "../../App";
import CalendarPanel from "./CalendarPanel";
import DayView from "./DayView";
import GoogleSyncBadge from "./GoogleSyncBadge";
import MonthView from "./MonthView";
import PeerSyncBadge from "./PeerSyncBadge";
import SyncConflictModal from "./SyncConflictModal";
import WeekView from "./WeekView";

type CalendarTab = "week" | "day" | "month";

function describeFeedRepair(raw: string | null): { title: string; detail: string } {
  switch (raw) {
    case "token_invalid_or_revoked":
      return {
        title: "Reconnect with a fresh setup code",
        detail: "The other install no longer accepts this token, so mirrored events may be stale until the feed is reconnected.",
      };
    case "redirect_not_allowed":
      return {
        title: "Fix the saved base URL",
        detail: "This feed is pointing through a redirect. Use the direct DopaFlow API base URL from the other install before trusting it again.",
      };
    case "invalid_feed_payload":
      return {
        title: "The remote URL is not returning a valid calendar feed",
        detail: "It is likely pointed at the wrong place. Confirm the saved URL ends in the other install's /api/v2 path.",
      };
    default:
      if (raw && /^HTTP 404$/i.test(raw)) {
        return {
          title: "Feed endpoint not found",
          detail: "The saved base URL looks wrong or incomplete, so this mirror needs its connection details checked.",
        };
      }
      if (raw && /^HTTP 5\d\d$/i.test(raw)) {
        return {
          title: "The remote install is temporarily unavailable",
          detail: "Retry sync after the other app comes back. Until then, rely on local events carefully.",
        };
      }
      return {
        title: "Mirror needs attention",
        detail: "Open sharing settings, retry the feed, and replace the setup code if the problem repeats.",
      };
  }
}

export default function CalendarView(): JSX.Element {
  const app = useContext(AppDataContext);
  const [tab, setTab] = useState<CalendarTab>("week");
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [hiddenSources, setHiddenSources] = useState<string[]>([]);
  const [prefillHour, setPrefillHour] = useState<number | null>(null);
  const [prefillTitle, setPrefillTitle] = useState<string>("");
  const [blockReminder, setBlockReminder] = useState<boolean>(false);
  const [blockReminderOffset, setBlockReminderOffset] = useState<number>(15);
  const [showConflicts, setShowConflicts] = useState<boolean>(false);

  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);

  const dayAnchor = new Date();
  dayAnchor.setDate(dayAnchor.getDate() + dayOffset);
  const monthAnchor = new Date();
  monthAnchor.setMonth(monthAnchor.getMonth() + weekOffset);

  const weekLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayLabel = dayAnchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const monthLabel = monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const pendingTasks = (app.tasks?.tasks ?? []).filter((t) => !t.done && t.status !== "cancelled");
  const sourceMeta = [
    { id: "local", label: "My calendar", color: "var(--accent)", readonly: false },
    ...app.calendar.peerFeeds.map((feed) => ({
      id: feed.id,
      label: feed.label,
      color: feed.color,
      readonly: true,
    })),
  ];
  const sourceColors = Object.fromEntries(sourceMeta.map((source) => [source.id, source.color]));
  const sourceLabels = Object.fromEntries(sourceMeta.map((source) => [source.id, source.label]));
  const filteredEvents = app.calendar.events.filter((event) => {
    const sourceId = event.source_type?.startsWith("peer:") ? event.source_type.slice("peer:".length) : "local";
    return !hiddenSources.includes(sourceId);
  });
  const sharedEvents = app.calendar.events.filter((event) => event.source_type?.startsWith("peer:")).length;
  const visibleSharedEvents = filteredEvents.filter((event) => event.source_type?.startsWith("peer:")).length;
  const allSharedSourcesHidden = app.calendar.peerFeeds.length > 0 && app.calendar.peerFeeds.every((feed) => hiddenSources.includes(feed.id));
  const staleThresholdMs = 36 * 60 * 60 * 1000;
  const staleFeeds = app.calendar.peerFeeds.filter((feed) => {
    if (!feed.last_synced_at) {
      return feed.sync_status !== "syncing";
    }
    return Date.now() - new Date(feed.last_synced_at).getTime() > staleThresholdMs;
  });
  const summaryChips = useMemo(() => [
    `${filteredEvents.length} visible`,
    `${sharedEvents} shared`,
    `${pendingTasks.length} open tasks`,
  ], [filteredEvents.length, pendingTasks.length, sharedEvents]);

  const calendarRunway = (() => {
    if (app.calendar.conflictCount > 0) {
      return {
        eyebrow: "Needs attention",
        title: `${app.calendar.conflictCount} sync conflict${app.calendar.conflictCount === 1 ? "" : "s"} need a decision`,
        body: "Resolve conflicts first so the calendar stops feeling untrustworthy across devices and feeds.",
      };
    }
    if (app.calendar.peerFeeds.some((feed) => feed.sync_status === "error")) {
      return {
        eyebrow: "Shared source error",
        title: "At least one mirrored calendar failed to sync",
        body: "The feed is still connected, but its latest import failed. Check the source health cards below before relying on it.",
      };
    }
    if (staleFeeds.length > 0 && app.calendar.peerFeeds.length > 0) {
      return {
        eyebrow: "Stale feed",
        title: `${staleFeeds.length} shared source${staleFeeds.length === 1 ? "" : "s"} may be out of date`,
        body: "The connection still exists, but it has not refreshed recently enough to trust blindly.",
      };
    }
    if (app.calendar.peerFeeds.length > 0) {
      return {
        eyebrow: "Shared calendars live",
        title: "Local planning and mirrored calendars are in one place",
        body: "Read-only feed labels and health status stay visible here so you do not have to bounce back to settings to trust the view.",
      };
    }
    return {
      eyebrow: "Local planning",
      title: "Block time against real workload, not guesswork",
      body: "Use week, day, and month views to place work deliberately before it turns into backlog drift.",
    };
  })();

  const formatSyncAge = (iso: string | null): string => {
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
  };

  const toggleSource = (sourceId: string): void => {
    setHiddenSources((current) => (
      current.includes(sourceId)
        ? current.filter((value) => value !== sourceId)
        : [...current, sourceId]
    ));
  };

  const handleSlotClick = (hour: number): void => {
    setPrefillHour(hour);
  };

  const handleScheduleTask = (taskTitle: string, hour: number): void => {
    setPrefillTitle(taskTitle);
    setPrefillHour(hour);
  };

  const tabBtn = (id: CalendarTab, label: string): JSX.Element => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: "0.52rem 0.95rem",
        borderRadius: "12px",
        border: "1px solid",
        borderColor: tab === id ? "var(--accent)" : "var(--border-subtle)",
        background: tab === id ? "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))" : "color-mix(in srgb, var(--surface) 76%, white 24%)",
        color: tab === id ? "var(--text-inverted)" : "var(--text-secondary)",
        cursor: "pointer",
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        boxShadow: tab === id ? "var(--shadow-soft)" : "none",
        transition: "transform 160ms ease, border-color 160ms ease, opacity 160ms ease",
      }}
    >
      {label}
    </button>
  );

  const navBtn = (label: string, onClick: () => void): JSX.Element => (
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

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section
        style={{
          display: "grid",
          gap: "0.9rem",
          padding: "1.1rem 1.2rem 1.2rem",
          borderRadius: "22px",
          border: "1px solid var(--border-subtle)",
          background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 84%, white 16%), var(--surface))",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.45rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Planning surface
            </span>
            <div style={{ display: "grid", gap: "0.15rem" }}>
              <strong style={{ fontSize: "clamp(1.25rem, 2vw, 1.65rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
                {tab === "week" ? weekLabel : tab === "day" ? dayLabel : monthLabel}
              </strong>
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                {calendarRunway.body}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
            {tabBtn("week", "Week")}
            {tabBtn("day", "Day")}
            {tabBtn("month", "Month")}
          </div>
        </div>

        <div
          style={{
            padding: "0.85rem 0.95rem",
            borderRadius: "16px",
            background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
            border: "1px solid var(--border-subtle)",
            display: "grid",
            gap: "0.3rem",
          }}
        >
          <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
            {calendarRunway.eyebrow}
          </span>
          <strong style={{ fontSize: "var(--text-base)" }}>{calendarRunway.title}</strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
            {summaryChips.map((chip) => (
              <span
                key={chip}
                style={{
                  padding: "0.38rem 0.7rem",
                  borderRadius: "999px",
                  background: "color-mix(in srgb, var(--surface) 74%, white 26%)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
          {app.calendar.conflictCount > 0 && (
            <button
              onClick={() => setShowConflicts(true)}
              title={`${app.calendar.conflictCount} sync conflict${app.calendar.conflictCount > 1 ? "s" : ""}`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.48rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid var(--state-overdue)",
                background: "color-mix(in srgb, var(--state-overdue) 10%, var(--surface))",
                cursor: "pointer",
                color: "var(--state-overdue)",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
              }}
            >
              Sync conflict{app.calendar.conflictCount > 1 ? "s" : ""}: {app.calendar.conflictCount}
            </button>
          )}
          {app.calendar.peerFeeds.length > 0 && (
            <PeerSyncBadge
              feeds={app.calendar.peerFeeds}
              onSync={() => void app.calendar.syncAllPeers()}
            />
          )}
          <GoogleSyncBadge
            status={app.calendar.syncStatus}
            onSync={() => void app.calendar.syncGoogle()}
          />
        </div>
        {showConflicts && (
          <SyncConflictModal
            conflicts={app.calendar.conflicts}
            onResolve={async (id, resolution) => {
              await app.calendar.resolveConflict(id, resolution);
            }}
            onClose={() => setShowConflicts(false)}
          />
        )}
        </div>
      </section>

      {app.calendar.peerFeeds.length > 0 && (
        <section
          style={{
            display: "grid",
            gap: "0.8rem",
            padding: "1rem",
            borderRadius: "18px",
            border: "1px solid var(--border-subtle)",
            background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 82%, white 18%), var(--surface))",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "0.2rem" }}>
              <strong style={{ fontSize: "var(--text-base)" }}>Shared calendars are live in this view</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                Mirror feeds stay read-only here so future user-to-user sharing can add permissions cleanly instead of rewriting the model later.
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ padding: "0.35rem 0.65rem", borderRadius: "999px", background: "var(--surface-2)", fontSize: "var(--text-sm)" }}>
                {filteredEvents.length} visible events
              </span>
              <span style={{ padding: "0.35rem 0.65rem", borderRadius: "999px", background: "var(--surface-2)", fontSize: "var(--text-sm)" }}>
                {sharedEvents} shared
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            {sourceMeta.map((source) => {
              const hidden = hiddenSources.includes(source.id);
              const count = app.calendar.events.filter((event) => {
                const sourceId = event.source_type?.startsWith("peer:") ? event.source_type.slice("peer:".length) : "local";
                return sourceId === source.id;
              }).length;

              return (
                <button
                  key={source.id}
                  onClick={() => toggleSource(source.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.45rem 0.8rem",
                    borderRadius: "999px",
                    border: `1px solid ${hidden ? "var(--border-subtle)" : source.color}`,
                    background: hidden ? "transparent" : "color-mix(in srgb, var(--surface) 82%, white 18%)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    opacity: hidden ? 0.58 : 1,
                  }}
                  title={hidden ? `Show ${source.label}` : `Hide ${source.label}`}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: source.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{source.label}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{count}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {app.calendar.peerFeeds.map((feed) => {
              const isStale = staleFeeds.some((candidate) => candidate.id === feed.id);
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "start" }}>
                    <div style={{ display: "grid", gap: "0.18rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ width: "9px", height: "9px", borderRadius: "999px", background: feed.color, flexShrink: 0 }} />
                        <strong>{feed.label}</strong>
                      </div>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
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
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    Last successful sync: {formatSyncAge(feed.last_synced_at)}
                  </span>
                  <span style={{ fontSize: "var(--text-sm)", color: feed.last_error ? "var(--state-overdue)" : "var(--text-secondary)", lineHeight: 1.5 }}>
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
              All shared calendars are hidden right now. Re-enable a source chip above to see mirrored events again.
            </div>
          )}
          {!allSharedSourcesHidden && sharedEvents > 0 && visibleSharedEvents === 0 && (
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
              Shared calendars are connected, but there are no mirrored events in the visible range for this view.
            </div>
          )}
        </section>
      )}

      {tab === "week" && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {navBtn("Previous", () => setWeekOffset((v) => v - 1))}
            <strong style={{ minWidth: "140px", textAlign: "center" }}>{weekLabel}</strong>
            {navBtn("Next", () => setWeekOffset((v) => v + 1))}
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{
                  padding: "0.5rem 0.85rem",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))",
                  color: "var(--text-inverted)",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                Today
              </button>
            )}
          </div>
          <WeekView
            events={filteredEvents}
            anchorDate={anchor}
            sourceColors={sourceColors}
            sourceLabels={sourceLabels}
          />
          <CalendarPanel onCreate={(event) => app.calendar.create(event)} />
        </>
      )}

      {tab === "month" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {navBtn("Previous", () => setWeekOffset((v) => v - 1))}
            <strong style={{ minWidth: "160px", textAlign: "center" }}>{monthLabel}</strong>
            {navBtn("Next", () => setWeekOffset((v) => v + 1))}
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{
                  padding: "0.5rem 0.85rem",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))",
                  color: "var(--text-inverted)",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                Today
              </button>
            )}
          </div>
          <MonthView
            events={filteredEvents}
            month={monthAnchor}
            sourceColors={sourceColors}
            sourceLabels={sourceLabels}
          />
        </div>
      )}

      {tab === "day" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", alignItems: "start" }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {navBtn("Previous", () => setDayOffset((v) => v - 1))}
              <strong style={{ minWidth: "180px", textAlign: "center" }}>{dayLabel}</strong>
              {navBtn("Next", () => setDayOffset((v) => v + 1))}
              {dayOffset !== 0 && (
                <button
                  onClick={() => setDayOffset(0)}
                  style={{
                    padding: "0.5rem 0.85rem",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))",
                    color: "var(--text-inverted)",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                    fontWeight: 700,
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  Today
                </button>
              )}
            </div>
            <DayView
              events={filteredEvents}
              date={dayAnchor}
              onSlotClick={handleSlotClick}
              sourceColors={sourceColors}
              sourceLabels={sourceLabels}
            />
          </div>

          {/* Time blocking sidebar */}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {/* Quick block form */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "16px",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gap: "0.65rem",
              }}
            >
              <strong style={{ fontSize: "var(--text-sm)" }}>
                {prefillHour !== null ? `Block ${String(prefillHour).padStart(2, "0")}:00` : "Time block"}
              </strong>
              <input
                value={prefillTitle}
                onChange={(e) => setPrefillTitle(e.target.value)}
                placeholder="What are you blocking time for?"
                style={{
                  padding: "0.5rem 0.65rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--surface-2, var(--surface))",
                  color: "var(--text)",
                  fontSize: "var(--text-sm)",
                  fontFamily: "inherit",
                  width: "100%",
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && prefillTitle.trim() && prefillHour !== null) {
                    const d = new Date(dayAnchor);
                    d.setHours(prefillHour, 0, 0, 0);
                    const end = new Date(d.getTime() + 60 * 60_000);
                    void app.calendar.create({
                      title: prefillTitle.trim(),
                      start_at: d.toISOString(),
                      end_at: end.toISOString(),
                      all_day: false,
                    }).then(async () => {
                      if (blockReminder) {
                        const fireAt = new Date(d.getTime() - blockReminderOffset * 60_000);
                        await app.alarms.create({
                          title: prefillTitle.trim(),
                          at: fireAt.toISOString(),
                          kind: "tts",
                          tts_text: `Starting soon: ${prefillTitle.trim()}`,
                        });
                      }
                      setPrefillTitle("");
                      setPrefillHour(null);
                      setBlockReminder(false);
                    });
                  }
                }}
              />
              {prefillHour === null && (
                <p style={{ margin: 0, fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Click any hour slot on the calendar to pick a time.
                </p>
              )}
              {prefillHour !== null && (
                <>
                  <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                    <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      <input
                        type="checkbox"
                        checked={blockReminder}
                        onChange={(e) => setBlockReminder(e.target.checked)}
                        style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                      />
                      Remind me
                    </label>
                    {blockReminder && (
                      <select
                        value={blockReminderOffset}
                        onChange={(e) => setBlockReminderOffset(Number(e.target.value))}
                        style={{
                          padding: "0.3rem 0.5rem",
                          borderRadius: "8px",
                          border: "1px solid var(--border-subtle)",
                          background: "var(--surface-2, var(--surface))",
                          color: "var(--text)",
                          fontSize: "var(--text-sm)",
                          fontFamily: "inherit",
                        }}
                      >
                        <option value={5}>5 min before</option>
                        <option value={15}>15 min before</option>
                        <option value={30}>30 min before</option>
                        <option value={60}>1 hour before</option>
                      </select>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                    disabled={!prefillTitle.trim()}
                    onClick={() => {
                      if (!prefillTitle.trim() || prefillHour === null) return;
                      const d = new Date(dayAnchor);
                      d.setHours(prefillHour, 0, 0, 0);
                      const end = new Date(d.getTime() + 60 * 60_000);
                      void app.calendar.create({
                        title: prefillTitle.trim(),
                        start_at: d.toISOString(),
                        end_at: end.toISOString(),
                        all_day: false,
                      }).then(async () => {
                        if (blockReminder) {
                          const fireAt = new Date(d.getTime() - blockReminderOffset * 60_000);
                          await app.alarms.create({
                            title: prefillTitle.trim(),
                            at: fireAt.toISOString(),
                            kind: "tts",
                            tts_text: `Starting soon: ${prefillTitle.trim()}`,
                          });
                        }
                        setPrefillTitle("");
                        setPrefillHour(null);
                        setBlockReminder(false);
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: "0.45rem",
                      borderRadius: "8px",
                      border: "none",
                      background: prefillTitle.trim() ? "var(--accent)" : "var(--border-subtle)",
                      color: "var(--text-inverted)",
                      cursor: prefillTitle.trim() ? "pointer" : "not-allowed",
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                    }}
                  >
                    Block it
                  </button>
                  <button
                    onClick={() => { setPrefillHour(null); setPrefillTitle(""); }}
                    style={{
                      padding: "0.45rem 0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    X
                  </button>
                  </div>
                </>
              )}
            </div>

            {/* Pending tasks to schedule */}
            {pendingTasks.length > 0 && (
              <div
                style={{
                  padding: "1rem",
                  borderRadius: "16px",
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Schedule a task
                </span>
                <div style={{ display: "grid", gap: "0.35rem", maxHeight: "320px", overflowY: "auto" }}>
                  {pendingTasks.slice(0, 20).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        const hour = prefillHour ?? new Date().getHours() + 1;
                        handleScheduleTask(task.title, hour);
                      }}
                      style={{
                        padding: "0.45rem 0.6rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface-2, var(--surface))",
                        cursor: "pointer",
                        display: "flex",
                        gap: "0.4rem",
                        alignItems: "center",
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          const hour = prefillHour ?? new Date().getHours() + 1;
                          handleScheduleTask(task.title, hour);
                        }
                      }}
                    >
                      <span
                        style={{
                          padding: "0.16rem 0.42rem",
                          borderRadius: "999px",
                          background: task.priority <= 2 ? "var(--state-warn)16" : "var(--surface)",
                          color: task.priority <= 2 ? "var(--state-warn)" : "var(--text-secondary)",
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        P{task.priority}
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
