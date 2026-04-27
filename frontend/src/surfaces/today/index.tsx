import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";

import type { Task } from "../../../../shared/types";
import {
  useAppCalendar,
  useAppFocus,
  useAppHabits,
  useAppInsights,
  useAppPacky,
  useAppProjects,
  useAppTasks,
} from "../../app/AppContexts";
import BacklogColumn from "./BacklogColumn";
import ContextCard from "./ContextCard";
import DailyQuote from "../../components/DailyQuote";
import FocusQueue from "./FocusQueue";
import HabitsToday from "./HabitsToday";
import MomentumCard from "./MomentumCard";
import TaskEditModal from "../tasks/TaskEditModal";
import TimeBlocks from "./TimeBlocks";
import { TodayHeaderPanel } from "./TodayHeaderPanel";
import { TodaySurfaceSkeleton } from "@ds/primitives/Skeleton";
import { apiClient } from "../../api/client";
import {
  TODAY_KEY,
  getTodayDayState,
  getTodayNextAction,
  isSameDay,
} from "./TodayShared";

export default function TodayView(): JSX.Element {
  const tasks = useAppTasks();
  const projects = useAppProjects();
  const habits = useAppHabits();
  const insights = useAppInsights();
  const focus = useAppFocus();
  const calendar = useAppCalendar();
  const packy = useAppPacky();
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [focusQueueIds, setFocusQueueIds] = useState<string[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [quote, setQuote] = useState<string>("");
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1180px)").matches
      : false,
  );

  // selectedDate must be computed before memos that depend on it
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const activeProjectId = projects.activeProjectId ?? null;
  const selectedDateIso = selectedDate.toISOString().slice(0, 10);
  const plannedToday =
    dayOffset === 0 && localStorage.getItem(TODAY_KEY) === selectedDateIso;

  const focusQueue = useMemo(
    () =>
      tasks.tasks.filter(
        (task) =>
          (isSameDay(task.due_at, selectedDate) ||
            focusQueueIds.includes(task.id)) &&
          (!activeProjectId || task.project_id === activeProjectId),
      ),
    [tasks.tasks, focusQueueIds, selectedDate, activeProjectId],
  );

  const backlog = useMemo(
    () =>
      tasks.tasks.filter(
        (task) =>
          !task.due_at &&
          !focusQueueIds.includes(task.id) &&
          (!activeProjectId || task.project_id === activeProjectId),
      ),
    [tasks.tasks, focusQueueIds, activeProjectId],
  );

  const overdueTasks = useMemo(
    () =>
      tasks.tasks.filter(
        (task) =>
          !task.done &&
          Boolean(task.due_at) &&
          (task.due_at as string).slice(0, 10) < selectedDateIso &&
          (!activeProjectId || task.project_id === activeProjectId),
      ),
    [activeProjectId, tasks.tasks, selectedDateIso],
  );

  const completedToday = useMemo(
    () =>
      tasks.tasks.filter(
        (task) =>
          task.done &&
          task.updated_at?.slice(0, 10) === selectedDateIso &&
          (!activeProjectId || task.project_id === activeProjectId),
      ).length,
    [activeProjectId, tasks.tasks, selectedDateIso],
  );

  const upcomingEvents = useMemo(
    () =>
      calendar.events
        .filter((event) => isSameDay(event.start_at, selectedDate))
        .sort(
          (left, right) =>
            new Date(left.start_at).getTime() -
            new Date(right.start_at).getTime(),
        )
        .slice(0, 3),
    [calendar.events, selectedDate],
  );

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
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 1180px)");
    const onChange = (event: MediaQueryListEvent): void =>
      setIsCompactLayout(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isLoading = tasks.loading || habits.loading;

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
      setFocusQueueIds((current) =>
        current.includes(taskId) ? current : [...current, taskId],
      );
    }
  };

  const nextFocusTask = focusQueue.find((task) => !task.done) ?? null;
  const nextUpcomingEvent = upcomingEvents[0] ?? null;
  const dayState = getTodayDayState(dayOffset, plannedToday);
  const nextAction = getTodayNextAction({
    activeFocusSession: Boolean(focus.activeSession),
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
        gridTemplateColumns: isCompactLayout
          ? "minmax(0, 1fr)"
          : "minmax(0, 1.9fr) minmax(300px, 0.95fr)",
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

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDropToQueue}
        >
          <FocusQueue
            tasks={focusQueue}
            habits={habits.habits}
            events={upcomingEvents}
            activeSession={focus.activeSession}
            onStartFocus={(taskId, mins) =>
              void focus.start(taskId, mins ?? 25)
            }
            onComplete={(taskId) => void tasks.complete(taskId)}
            onEdit={(task) => setEditingTask(task)}
            onHabitCheckIn={(id) => void habits.checkIn(id)}
          />
        </div>

        <TimeBlocks sessions={focus.sessions} events={calendar.events} />

        <MomentumCard
          momentum={packy.momentum ?? insights.momentum}
          packyLine={packy.whisper?.text}
        />
        {quote ? <DailyQuote quote={quote} /> : null}
      </section>

      <aside
        style={{
          display: "grid",
          gap: "1rem",
          alignContent: "start",
          gridTemplateColumns: isCompactLayout
            ? "repeat(auto-fit, minmax(260px, 1fr))"
            : "minmax(0, 1fr)",
          minWidth: 0,
        }}
      >
        <BacklogColumn
          tasks={backlog}
          onComplete={(id) => void tasks.complete(id)}
          onEdit={(task) => setEditingTask(task)}
          draggable
        />

        <HabitsToday habits={habits.habits} onCheckIn={habits.checkIn} />

        <ContextCard
          weeklyDigest={insights.weeklyDigest}
          correlations={insights.correlations}
        />
      </aside>
      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (id, patch) => {
          await tasks.update(id, patch);
        }}
        onDelete={async (id) => {
          await tasks.remove(id);
        }}
      />
    </div>
  );
}
