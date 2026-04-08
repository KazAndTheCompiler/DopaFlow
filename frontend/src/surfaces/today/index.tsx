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
import { TodaySurfaceSkeleton } from "@ds/primitives/Skeleton";
import { apiClient } from "../../api/client";

const FOCUS_PREFILL_KEY = "zoestm_focus_prefill";
const TODAY_KEY = "zoestm_planned_date";

function isSameDay(dateText: string | null | undefined, target: Date): boolean {
  if (!dateText) {
    return false;
  }
  return new Date(dateText).toDateString() === target.toDateString();
}

export default function TodayView(): JSX.Element {
  const app = useContext(AppDataContext);
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [focusQueueIds, setFocusQueueIds] = useState<string[]>([]);
  const [quote, setQuote] = useState<string>("");
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() => window.matchMedia("(max-width: 1180px)").matches);

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
  const dayState = dayOffset === 0
    ? plannedToday
      ? { label: "Planned", tone: "var(--state-completed)", bg: "color-mix(in srgb, var(--state-completed) 12%, var(--surface))" }
      : { label: "Needs plan", tone: "var(--state-warn)", bg: "color-mix(in srgb, var(--state-warn) 14%, var(--surface))" }
    : { label: dayOffset > 0 ? "Future" : "Review", tone: "var(--text-secondary)", bg: "var(--surface-2)" };

  const nextAction = (() => {
    if (app.focus.activeSession) {
      return {
        eyebrow: "In progress",
        title: "Keep the current session moving",
        body: "You already have an active focus block. Stay there until you pause, finish, or take a break.",
        primaryLabel: "Open focus",
        primaryAction: () => {
          window.location.hash = "#/focus";
        },
        secondaryLabel: "Review queue",
        secondaryAction: () => {
          window.location.hash = "#/today";
        },
      };
    }

    if (dayOffset === 0 && !plannedToday) {
      return {
        eyebrow: "Missing plan",
        title: "Plan the day before the backlog chooses for you",
        body: "Run the planning ritual first so your top three and first focus block are explicit.",
        primaryLabel: "Plan day",
        primaryAction: () => {
          window.location.hash = "#/plan";
        },
        secondaryLabel: "Open tasks",
        secondaryAction: () => {
          window.location.hash = "#/tasks";
        },
      };
    }

    if (overdueTasks.length > 0) {
      return {
        eyebrow: "Triage first",
        title: `${overdueTasks.length} older task${overdueTasks.length === 1 ? "" : "s"} need a decision`,
        body: "Carry forward, reschedule, or drop them before you start another block and create more spillover.",
        primaryLabel: "Open tasks",
        primaryAction: () => {
          window.location.hash = "#/tasks";
        },
        secondaryLabel: "Open plan",
        secondaryAction: () => {
          window.location.hash = "#/plan";
        },
      };
    }

    if (nextFocusTask) {
      return {
        eyebrow: "Ready to execute",
        title: `Start with ${nextFocusTask.title}`,
        body: "Your queue is ready. Move straight into a focus block instead of reopening the whole backlog.",
        primaryLabel: "Set up focus",
        primaryAction: () => {
          localStorage.setItem(FOCUS_PREFILL_KEY, nextFocusTask.title);
          window.location.hash = "#/focus";
        },
        secondaryLabel: "Open calendar",
        secondaryAction: () => {
          window.location.hash = "#/calendar";
        },
      };
    }

    if (backlog.length > 0) {
      return {
        eyebrow: "Queue empty",
        title: "Pull one task into the day",
        body: "Drag a backlog item into the queue so you have a clear next move instead of a long list.",
        primaryLabel: "Open tasks",
        primaryAction: () => {
          window.location.hash = "#/tasks";
        },
        secondaryLabel: "Review backlog",
        secondaryAction: () => {
          window.location.hash = "#/today";
        },
      };
    }

    return {
      eyebrow: "Clear runway",
      title: "You have room to plan intentionally",
      body: "Nothing urgent is pulling at you. Use that space to plan tomorrow, review, or recover.",
      primaryLabel: "Open overview",
      primaryAction: () => {
        window.location.hash = "#/overview";
      },
      secondaryLabel: "Shutdown",
      secondaryAction: () => {
        window.location.hash = "#/shutdown";
      },
    };
  })();

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
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
            padding: "1rem",
            borderRadius: "20px",
            background: "color-mix(in srgb, var(--surface) 92%, transparent)",
            backdropFilter: "var(--surface-glass-blur, blur(14px))",
            border: "1px solid var(--border-subtle)",
            position: "relative",
          }}
        >
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
              <strong style={{ display: "block", fontSize: "var(--text-lg)" }}>Today</strong>
              <span
                style={{
                  padding: "0.2rem 0.55rem",
                  borderRadius: "999px",
                  background: dayState.bg,
                  color: dayState.tone,
                  fontSize: "var(--text-xs)",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {dayState.label}
              </span>
            </div>
            <span style={{ color: "var(--text-secondary)" }}>{dateLabel}</span>
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setDayOffset((v) => v - 1)}
              aria-label="Previous day"
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              ‹ Prev
            </button>
            <button
              onClick={() => setDayOffset(0)}
              aria-label="Jump to today"
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: dayOffset === 0 ? "var(--accent)" : "transparent",
                color: dayOffset === 0 ? "white" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
              }}
            >
              Today
            </button>
            <button
              onClick={() => setDayOffset((v) => v + 1)}
              aria-label="Next day"
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              Next ›
            </button>
          </div>
        </header>

        <section
          style={{
            padding: "1.1rem 1.15rem",
            borderRadius: "20px",
            background: "linear-gradient(145deg, color-mix(in srgb, var(--accent) 10%, var(--surface)), var(--surface))",
            border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
            display: "grid",
            gap: "0.9rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.75rem",
              alignItems: "start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 800,
                }}
              >
                {nextAction.eyebrow}
              </span>
              <strong style={{ fontSize: "var(--text-lg)" }}>{nextAction.title}</strong>
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
                {nextAction.body}
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={nextAction.primaryAction}
                style={{
                  padding: "0.6rem 0.95rem",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text-inverted)",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "var(--text-sm)",
                }}
              >
                {nextAction.primaryLabel}
              </button>
              <button
                onClick={nextAction.secondaryAction}
                style={{
                  padding: "0.6rem 0.95rem",
                  borderRadius: "10px",
                  border: "1px solid var(--border-subtle)",
                  background: "color-mix(in srgb, var(--surface) 76%, white 24%)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "var(--text-sm)",
                }}
              >
                {nextAction.secondaryLabel}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem", position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Queue
              </span>
              <strong style={{ fontSize: "1.35rem" }}>{focusQueue.filter((task) => !task.done).length}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                ready to execute
              </span>
            </div>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem", position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Backlog
              </span>
              <strong style={{ fontSize: "1.35rem" }}>{backlog.length}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                unscheduled tasks
              </span>
            </div>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem", position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Done
              </span>
              <strong style={{ fontSize: "1.35rem" }}>{completedToday}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                completed on this date
              </span>
            </div>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem", position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Next event
              </span>
              <strong style={{ fontSize: nextUpcomingEvent ? "var(--text-base)" : "1.35rem" }}>
                {nextUpcomingEvent
                  ? new Date(nextUpcomingEvent.start_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "Clear"}
              </strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {nextUpcomingEvent ? nextUpcomingEvent.title : "no calendar block yet"}
              </span>
            </div>
          </div>
        </section>

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
