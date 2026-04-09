import { useContext, useEffect, useMemo, useState } from "react";

import { AppDataContext } from "../../App";
import { showToast } from "@ds/primitives/Toast";
import { CalendarDaySidebar } from "./CalendarDaySidebar";
import { CalendarHeaderPanel } from "./CalendarHeaderPanel";
import CalendarPanel from "./CalendarPanel";
import CalendarEventModal from "./CalendarEventModal";
import { CalendarNavButton, CalendarSharedFeedsPanel, type CalendarTab } from "./CalendarViewShared";
import { buildCalendarViewModel } from "./calendarViewModel";
import DayView from "./DayView";
import MonthView from "./MonthView";
import WeekView from "./WeekView";

export default function CalendarView(): JSX.Element {
  const app = useContext(AppDataContext);
  const [tab, setTab] = useState<CalendarTab>("week");
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [hiddenSources, setHiddenSources] = useState<string[]>([]);
  const [prefillHour, setPrefillHour] = useState<number | null>(null);
  const [prefillTitle, setPrefillTitle] = useState<string>("");
  const [blockStartTime, setBlockStartTime] = useState<string>("09:00");
  const [blockDurationHours, setBlockDurationHours] = useState<number>(1);
  const [blockDurationMinutes, setBlockDurationMinutes] = useState<number>(0);
  const [blockReminder, setBlockReminder] = useState<boolean>(false);
  const [blockReminderOffset, setBlockReminderOffset] = useState<number>(15);
  const [showConflicts, setShowConflicts] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isNarrowCalendarLayout, setIsNarrowCalendarLayout] = useState<boolean>(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 960px)").matches
      : false
  ));

  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);

  const dayAnchor = new Date();
  dayAnchor.setDate(dayAnchor.getDate() + dayOffset);
  const monthAnchor = new Date();
  monthAnchor.setMonth(monthAnchor.getMonth() + weekOffset);

  const {
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
  } = useMemo(
    () =>
      buildCalendarViewModel({
        events: app.calendar.events,
        peerFeeds: app.calendar.peerFeeds,
        tasks: app.tasks?.tasks ?? [],
        hiddenSources,
        selectedEventId,
        anchor,
        dayAnchor,
        monthAnchor,
        conflictCount: app.calendar.conflictCount,
      }),
    [
      app.calendar.conflictCount,
      app.calendar.events,
      app.calendar.peerFeeds,
      app.tasks?.tasks,
      anchor,
      dayAnchor,
      hiddenSources,
      monthAnchor,
      selectedEventId,
    ],
  );

  const toggleSource = (sourceId: string): void => {
    setHiddenSources((current) => (
      current.includes(sourceId)
        ? current.filter((value) => value !== sourceId)
        : [...current, sourceId]
    ));
  };

  const handleSlotClick = (hour: number): void => {
    setPrefillHour(hour);
    setBlockStartTime(`${String(hour).padStart(2, "0")}:00`);
  };

  const handleScheduleTask = (taskTitle: string, hour: number): void => {
    setPrefillTitle(taskTitle);
    setPrefillHour(hour);
    setBlockStartTime(`${String(hour).padStart(2, "0")}:00`);
  };

  const clearBlockDraft = (): void => {
    setPrefillHour(null);
    setPrefillTitle("");
    setBlockReminder(false);
  };

  const handleEventClick = (eventId: string): void => {
    setSelectedEventId(eventId);
  };

  const handleRescheduleEvent = async (id: string, newStartAt: string): Promise<void> => {
    const event = app.calendar.events.find((e) => e.id === id);
    if (!event) return;
    const durationMs = new Date(event.end_at).getTime() - new Date(event.start_at).getTime();
    const newStart = new Date(newStartAt);
    const newEnd = new Date(newStart.getTime() + durationMs);
    try {
      await app.calendar.update(id, { start_at: newStart.toISOString(), end_at: newEnd.toISOString() });
      showToast("Event rescheduled.", "success");
    } catch {
      showToast("Could not reschedule event.", "error");
    }
  };

  const handleResizeEvent = async (id: string, newEndAt: string): Promise<void> => {
    try {
      await app.calendar.update(id, { end_at: newEndAt });
      showToast("Duration updated.", "success");
    } catch {
      showToast("Could not update event.", "error");
    }
  };

  const submitDayBlock = async (): Promise<void> => {
    if (!prefillTitle.trim()) return;
    const [hours, minutes] = blockStartTime.split(":").map((value) => Number(value) || 0);
    const start = new Date(dayAnchor);
    start.setHours(hours, minutes, 0, 0);
    const durationTotalMinutes = Math.max(1, blockDurationHours * 60 + blockDurationMinutes);
    const end = new Date(start.getTime() + durationTotalMinutes * 60_000);

    try {
      await app.calendar.create({
        title: prefillTitle.trim(),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: false,
      });
      if (blockReminder) {
        const fireAt = new Date(start.getTime() - blockReminderOffset * 60_000);
        await app.alarms.create({
          title: prefillTitle.trim(),
          at: fireAt.toISOString(),
          kind: "tts",
          tts_text: `Starting soon: ${prefillTitle.trim()}`,
        });
      }
      clearBlockDraft();
      showToast("Calendar block added.", "success");
    } catch {
      showToast("Could not add the calendar block.", "error");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 960px)");
    const onChange = (event: MediaQueryListEvent): void => setIsNarrowCalendarLayout(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <CalendarHeaderPanel
        tab={tab}
        title={tab === "week" ? weekLabel : tab === "day" ? dayLabel : monthLabel}
        calendarRunway={calendarRunway}
        summaryChips={summaryChips}
        conflictCount={app.calendar.conflictCount}
        peerFeeds={app.calendar.peerFeeds}
        syncStatus={app.calendar.syncStatus}
        showConflicts={showConflicts}
        conflicts={app.calendar.conflicts}
        onSelectTab={setTab}
        onShowConflicts={() => setShowConflicts(true)}
        onCloseConflicts={() => setShowConflicts(false)}
        onSyncAllPeers={() => void app.calendar.syncAllPeers()}
        onSyncGoogle={() => void app.calendar.syncGoogle()}
        onResolveConflict={async (id, resolution) => {
          await app.calendar.resolveConflict(id, resolution);
        }}
      />

      {app.calendar.peerFeeds.length > 0 && (
        <CalendarSharedFeedsPanel
          peerFeeds={app.calendar.peerFeeds}
          filteredEventsCount={filteredEvents.length}
          sharedEvents={sharedEvents}
          hiddenSources={hiddenSources}
          sourceMeta={sourceMeta}
          events={app.calendar.events}
          staleFeeds={staleFeeds}
          allSharedSourcesHidden={allSharedSourcesHidden}
          visibleSharedEvents={visibleSharedEvents}
          onToggleSource={toggleSource}
        />
      )}

      {tab === "week" && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <CalendarNavButton label="Previous" onClick={() => setWeekOffset((v) => v - 1)} />
            <strong style={{ minWidth: isNarrowCalendarLayout ? undefined : "140px", textAlign: "center" }}>{weekLabel}</strong>
            <CalendarNavButton label="Next" onClick={() => setWeekOffset((v) => v + 1)} />
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
            onEventClick={(event) => handleEventClick(event.id)}
          />
          <CalendarPanel
            onCreate={(event) => app.calendar.create(event)}
            onVoiceExecuted={() => {
              void app.calendar.refresh();
            }}
          />
        </>
      )}

      {tab === "month" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <CalendarNavButton label="Previous" onClick={() => setWeekOffset((v) => v - 1)} />
            <strong style={{ minWidth: isNarrowCalendarLayout ? undefined : "160px", textAlign: "center" }}>{monthLabel}</strong>
            <CalendarNavButton label="Next" onClick={() => setWeekOffset((v) => v + 1)} />
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
            onEventClick={(event) => handleEventClick(event.id)}
          />
        </div>
      )}

      {tab === "day" && (
        <div style={{ display: "grid", gridTemplateColumns: isNarrowCalendarLayout ? "1fr" : "minmax(0, 1.5fr) minmax(300px, 0.9fr)", gap: "1rem", alignItems: "start" }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <CalendarNavButton label="Previous" onClick={() => setDayOffset((v) => v - 1)} />
              <strong style={{ minWidth: isNarrowCalendarLayout ? undefined : "180px", textAlign: "center" }}>{dayLabel}</strong>
              <CalendarNavButton label="Next" onClick={() => setDayOffset((v) => v + 1)} />
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
              onEventClick={(event) => handleEventClick(event.id)}
              onRescheduleEvent={handleRescheduleEvent}
              onResizeEvent={handleResizeEvent}
            />
          </div>

          <CalendarDaySidebar
            isNarrowCalendarLayout={isNarrowCalendarLayout}
            prefillHour={prefillHour}
            prefillTitle={prefillTitle}
            blockStartTime={blockStartTime}
            blockDurationHours={blockDurationHours}
            blockDurationMinutes={blockDurationMinutes}
            blockReminder={blockReminder}
            blockReminderOffset={blockReminderOffset}
            pendingTasks={pendingTasks}
            onSetPrefillTitle={setPrefillTitle}
            onSetBlockStartTime={setBlockStartTime}
            onSetBlockDurationHours={setBlockDurationHours}
            onSetBlockDurationMinutes={setBlockDurationMinutes}
            onSetBlockReminder={setBlockReminder}
            onSetBlockReminderOffset={setBlockReminderOffset}
            onSubmitDayBlock={() => void submitDayBlock()}
            onClearBlockDraft={clearBlockDraft}
            onScheduleTask={handleScheduleTask}
          />
        </div>
      )}

      <CalendarEventModal
        event={selectedEvent}
        sourceColor={sourceColors[selectedSourceKey] ?? "var(--accent)"}
        sourceLabel={sourceLabels[selectedSourceKey] ?? "My calendar"}
        onClose={() => setSelectedEventId(null)}
        onSave={async (id, patch) => {
          try {
            await app.calendar.update(id, patch);
            showToast("Calendar event updated.", "success");
          } catch {
            showToast("Could not update the event.", "error");
          }
        }}
        onDelete={async (id) => {
          try {
            await app.calendar.remove(id);
            showToast("Calendar event deleted.", "success");
          } catch {
            showToast("Could not delete the event.", "error");
          }
        }}
      />
    </div>
  );
}
