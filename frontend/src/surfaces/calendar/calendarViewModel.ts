import type { CalendarEvent, PeerFeed, Task } from "../../../../shared/types";

export function buildCalendarViewModel({
  events,
  peerFeeds,
  tasks,
  hiddenSources,
  selectedEventId,
  anchor,
  dayAnchor,
  monthAnchor,
  conflictCount,
}: {
  events: CalendarEvent[];
  peerFeeds: PeerFeed[];
  tasks: Task[];
  hiddenSources: string[];
  selectedEventId: string | null;
  anchor: Date;
  dayAnchor: Date;
  monthAnchor: Date;
  conflictCount: number;
}) {
  const weekLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayLabel = dayAnchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const monthLabel = monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const pendingTasks = tasks.filter((task) => !task.done && task.status !== "cancelled");
  const sourceMeta = [
    { id: "local", label: "My calendar", color: "var(--accent)", readonly: false },
    ...peerFeeds.map((feed) => ({
      id: feed.id,
      label: feed.label,
      color: feed.color,
      readonly: true,
    })),
  ];
  const sourceColors = Object.fromEntries(sourceMeta.map((source) => [source.id, source.color]));
  const sourceLabels = Object.fromEntries(sourceMeta.map((source) => [source.id, source.label]));
  const filteredEvents = events.filter((event) => {
    const sourceId = event.source_type?.startsWith("peer:") ? event.source_type.slice("peer:".length) : "local";
    return !hiddenSources.includes(sourceId);
  });
  const sharedEvents = events.filter((event) => event.source_type?.startsWith("peer:")).length;
  const visibleSharedEvents = filteredEvents.filter((event) => event.source_type?.startsWith("peer:")).length;
  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null;
  const selectedSourceKey = selectedEvent?.source_type?.startsWith("peer:") ? selectedEvent.source_type.slice("peer:".length) : "local";
  const allSharedSourcesHidden = peerFeeds.length > 0 && peerFeeds.every((feed) => hiddenSources.includes(feed.id));
  const staleThresholdMs = 36 * 60 * 60 * 1000;
  const staleFeeds = peerFeeds.filter((feed) => {
    if (!feed.last_synced_at) {
      return feed.sync_status !== "syncing";
    }
    return Date.now() - new Date(feed.last_synced_at).getTime() > staleThresholdMs;
  });
  const summaryChips = [
    `${filteredEvents.length} visible`,
    `${sharedEvents} shared`,
    `${pendingTasks.length} open tasks`,
  ];

  const calendarRunway = (() => {
    if (conflictCount > 0) {
      return {
        eyebrow: "Needs attention",
        title: `${conflictCount} sync conflict${conflictCount === 1 ? "" : "s"} need a decision`,
        body: "Resolve conflicts first so the calendar stops feeling untrustworthy across devices and feeds.",
      };
    }
    if (peerFeeds.some((feed) => feed.sync_status === "error")) {
      return {
        eyebrow: "Shared source error",
        title: "At least one mirrored calendar failed to sync",
        body: "The feed is still connected, but its latest import failed. Check the source health cards below before relying on it.",
      };
    }
    if (staleFeeds.length > 0 && peerFeeds.length > 0) {
      return {
        eyebrow: "Stale feed",
        title: `${staleFeeds.length} shared source${staleFeeds.length === 1 ? "" : "s"} may be out of date`,
        body: "The connection still exists, but it has not refreshed recently enough to trust blindly.",
      };
    }
    if (peerFeeds.length > 0) {
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

  return {
    weekLabel,
    dayLabel,
    monthLabel,
    pendingTasks,
    sourceMeta,
    sourceColors,
    sourceLabels,
    filteredEvents,
    sharedEvents,
    visibleSharedEvents,
    selectedEvent,
    selectedSourceKey,
    allSharedSourcesHidden,
    staleFeeds,
    summaryChips,
    calendarRunway,
  };
}
