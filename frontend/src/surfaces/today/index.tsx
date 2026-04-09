import { useContext, useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";

import { AppDataContext } from "../../App";
import BacklogColumn from "./BacklogColumn";
import ContextCard from "./ContextCard";
import DailyQuote from "../../components/DailyQuote";
import FocusQueue from "./FocusQueue";
import HabitsToday from "./HabitsToday";
import MomentumCard from "./MomentumCard";
import TimeBlocks from "./TimeBlocks";
import { TodayHeaderPanel } from "./TodayHeaderPanel";
import { TodaySurfaceSkeleton } from "@ds/primitives/Skeleton";
import { apiClient } from "../../api/client";
import { TODAY_KEY, getTodayDayState, getTodayNextAction, isSameDay } from "./TodayShared";

export default function TodayView(): JSX.Element {
  const app = useContext(AppDataContext);
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [focusQueueIds, setFocusQueueIds] = useState<string[]>([]);
  const [quote, setQuote] = useState<string>("");
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1180px)").matches
      : false
  ));

  // selectedDate must be computed before memos that depend on it
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const activeProjectId = app?.projects?.activeProjectId ?? null;
  const selectedDateIso = selectedDate.toISOString().slice(0, 10);
  const plannedToday = dayOffset === 0 && localStorage.getItem(TODAY_KEY) === selectedDateIso;

  const focusQueue = useMemo(
    () =>
      (app?.tasks.tasks ?? []).filter(
        (task) =>
          (isSameDay(task.due_at, selectedDate) || focusQueueIds.includes(task.id)) &&
          (!activeProjectId || task.project_id === activeProjectId),
      ),
    [app?.tasks.tasks, focusQueueIds, selectedDate, activeProjectId],
  );

  const backlog = useMemo(
    () =>
      (app?.tasks.tasks ?? []).filter(
        (task) =>
          !task.due_at &&
          !focusQueueIds.includes(task.id) &&
          (!activeProjectId || task.project_id === activeProjectId),
      ),
    [app?.tasks.tasks, focusQueueIds, activeProjectId],
  );

  const overdueTasks = useMemo(
    () =>
      (app?.tasks.tasks ?? []).filter(
        (task) =>
          !task.done &&
          Boolean(task.due_at) &&
          task.due_at!.slice(0, 10) < selectedDateIso &&
          (!activeProjectId || task.project_id === activeProjectId),
      ),
    [activeProjectId, app?.tasks.tasks, selectedDateIso],
  );

  const completedToday = useMemo(
    () =>
      (app?.tasks.tasks ?? []).filter(
        (task) =>
          task.done &&
          task.updated_at?.slice(0, 10) === selectedDateIso &&
          (!activeProjectId || task.project_id === activeProjectId),
      ).length,
    [activeProjectId, app?.tasks.tasks, selectedDateIso],
  );

  const upcomingEvents = useMemo(
    () =>
      (app?.calendar.events ?? [])
        .filter((event) => isSameDay(event.start_at, selectedDate))
        .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime())
        .slice(0, 3),
    [app?.calendar.events, selectedDate],
  );

  useEffect(() => {
    if (!app) return;
    void Promise.all([app.tasks.refresh(), app.habits.refresh(), app.insights.refresh(), app.focus.refresh()]);
    // Run once on mount — app context reference is stable after first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    void apiClient<{ quote?: string }>("/motivation/quote")
      .then((body) => {
        if (!cancelled) {
          setQuote(body.quote ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuote("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 1180px)");
    const onChange = (event: MediaQueryListEvent): void => setIsCompactLayout(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const isLoading = app.tasks.loading || app.habits.loading;

  if (isLoading) {
    return <TodaySurfaceSkeleton />;
  }

  const dateLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const onDropToQueue = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/task-id");
    if (taskId) {
      setFocusQueueIds((current) => (current.includes(taskId) ? current : [...current, taskId]));
    }
  };

  const nextFocusTask = focusQueue.find((task) => !task.done) ?? null;
  const nextUpcomingEvent = upcomingEvents[0] ?? null;
  const dayState = getTodayDayState(dayOffset, plannedToday);
  const nextAction = getTodayNextAction({
    activeFocusSession: Boolean(app.focus.activeSession),
    dayOffset,
    plannedToday,
    overdueTasks,
    nextFocusTask,
    backlog,
  });

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: isCompactLayout ? "minmax(0, 1fr)" : "minmax(0, 1.9fr) minmax(300px, 0.95fr)",
        alignItems: "start",
      }}
    >
      <section style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
        <TodayHeaderPanel
          dateLabel={dateLabel}
          dayState={dayState}
          dayOffset={dayOffset}
          onPrevDay={() => setDayOffset((v) => v - 1)}
          onToday={() => setDayOffset(0)}
          onNextDay={() => setDayOffset((v) => v + 1)}
          nextAction={nextAction}
          focusQueue={focusQueue}
          backlogCount={backlog.length}
          completedToday={completedToday}
          nextUpcomingEvent={nextUpcomingEvent}
        />

        <div onDragOver={(event) => event.preventDefault()} onDrop={onDropToQueue}>
          <FocusQueue
            tasks={focusQueue}
            activeSession={app.focus.activeSession}
            onStartFocus={(taskId, mins) => void app.focus.start(taskId, mins ?? 25)}
            onComplete={(taskId) => void app.tasks.complete(taskId)}
          />
        </div>

        <TimeBlocks sessions={app.focus.sessions} events={app.calendar.events} />

        <MomentumCard momentum={app.packy.momentum ?? app.insights.momentum} packyLine={app.packy.whisper?.text} />
        {quote ? <DailyQuote quote={quote} /> : null}
      </section>

      <aside
        style={{
          display: "grid",
          gap: "1rem",
          alignContent: "start",
          gridTemplateColumns: isCompactLayout ? "repeat(auto-fit, minmax(260px, 1fr))" : "minmax(0, 1fr)",
          minWidth: 0,
        }}
      >
        <BacklogColumn tasks={backlog} onComplete={(id) => void app.tasks.complete(id)} draggable />

        <HabitsToday habits={app.habits.habits} onCheckIn={app.habits.checkIn} />

        <ContextCard
          weeklyDigest={app.insights.weeklyDigest}
          correlations={app.insights.correlations}
        />
      </aside>
    </div>
  );
}
