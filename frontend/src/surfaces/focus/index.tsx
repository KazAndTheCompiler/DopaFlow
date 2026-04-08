import { useContext, useEffect, useState } from "react";
import type { TaskId } from "@shared/types";

import { AppDataContext } from "../../App";
import FocusPanel from "./FocusPanel";
import FocusTimer from "./FocusTimer";
import SessionHistory from "./SessionHistory";
import FocusCompleteModal from "./FocusCompleteModal";
import BreakTimerBanner, { BREAK_STORAGE_KEY } from "./BreakTimerBanner";

export default function FocusView(): JSX.Element {
  const app = useContext(AppDataContext);
  if (!app) {
    return <div>App context unavailable.</div>;
  }

  const { activeSession, sessions, start, control } = app.focus;
  const [showComplete, setShowComplete] = useState(false);
  const [completedDuration, setCompletedDuration] = useState(0);
  const [completedTaskId, setCompletedTaskId] = useState<string | undefined>();
  const [completedTaskTitle, setCompletedTaskTitle] = useState<string | undefined>();
  const [breakEndsAt, setBreakEndsAt] = useState<Date | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<TaskId | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1120px)").matches
      : false
  ));

  // Restore break state from localStorage on mount so navigating away and
  // back doesn't silently lose an active break.
  useEffect(() => {
    const stored = localStorage.getItem(BREAK_STORAGE_KEY);
    if (stored) {
      const end = new Date(stored);
      if (end.getTime() > Date.now()) {
        setBreakEndsAt(end);
      } else {
        localStorage.removeItem(BREAK_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 1120px)");
    const onChange = (event: MediaQueryListEvent): void => setIsCompactLayout(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleSessionComplete = async () => {
    if (activeSession) {
      setCompletedDuration(activeSession.duration_minutes);
      if (activeSession.task_id) {
        setCompletedTaskId(activeSession.task_id);
        const task = app.tasks.tasks.find((t) => t.id === activeSession.task_id);
        setCompletedTaskTitle(task?.title);
      }
    }
    await control("completed");
    setShowComplete(true);
  };

  const handleLogToTask = async () => {
    if (completedTaskId) {
      await app.tasks.complete(completedTaskId);
    }
    setShowComplete(false);
  };

  const handleStartAnotherFocus = async () => {
    const nextTaskId = completedTaskId ?? selectedTaskId ?? undefined;
    setShowComplete(false);
    setBreakEndsAt(null);
    localStorage.removeItem(BREAK_STORAGE_KEY);
    await start(nextTaskId, 25);
  };

  const handleStartBreak = (minutes: number) => {
    setBreakEndsAt(new Date(Date.now() + minutes * 60_000));
    setShowComplete(false);
  };

  const handleDismissBreak = () => {
    setBreakEndsAt(null);
    localStorage.removeItem(BREAK_STORAGE_KEY);
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayCompletedSessions = sessions.filter(
    (session) => session.status === "completed" && session.started_at?.slice(0, 10) === todayIso,
  );
  const focusMinutesToday = todayCompletedSessions.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0);
  const selectedTask = selectedTaskId ? app.tasks.tasks.find((task) => task.id === selectedTaskId) : null;
  const activeTask = activeSession?.task_id
    ? app.tasks.tasks.find((task) => task.id === activeSession.task_id) ?? null
    : null;

  const focusRunway = (() => {
    if (breakEndsAt) {
      return {
        eyebrow: "Recovery",
        title: "Protect the break so the next block stays clean",
        body: completedTaskTitle
          ? `You just finished ${completedTaskTitle}. Let the break finish, then re-enter deliberately instead of half-working.`
          : "A short reset now is worth more than stumbling straight into another shallow block.",
        primaryLabel: "End break",
        primaryAction: handleDismissBreak,
        secondaryLabel: "Open today",
        secondaryAction: () => {
          window.location.hash = "#/today";
        },
      };
    }

    if (activeSession) {
      return {
        eyebrow: "In session",
        title: activeTask ? `Protect ${activeTask.title}` : "Protect the current block",
        body: "Do one thing only until this timer ends. If the work changed, pause and relink it deliberately instead of context-switching mid-block.",
        primaryLabel: "Open today",
        primaryAction: () => {
          window.location.hash = "#/today";
        },
        secondaryLabel: "Open tasks",
        secondaryAction: () => {
          window.location.hash = "#/tasks";
        },
      };
    }

    if (selectedTask) {
      return {
        eyebrow: "Ready",
        title: `Start a block for ${selectedTask.title}`,
        body: "The task is already selected. Pick the right timer and begin before you drift back into list maintenance.",
        primaryLabel: "Review today",
        primaryAction: () => {
          window.location.hash = "#/today";
        },
        secondaryLabel: "Open tasks",
        secondaryAction: () => {
          window.location.hash = "#/tasks";
        },
      };
    }

    return {
      eyebrow: "Setup",
      title: "Choose one task before you start the timer",
      body: "A clean focus block starts with a concrete target. Pull something from Today or Tasks, then start the session.",
      primaryLabel: "Open today",
      primaryAction: () => {
        window.location.hash = "#/today";
      },
      secondaryLabel: "Open tasks",
      secondaryAction: () => {
        window.location.hash = "#/tasks";
      },
    };
  })();

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: isCompactLayout ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(240px, 360px)",
        alignItems: "start",
      }}
    >
      <div style={{ display: "grid", gap: "1rem", alignContent: "start", minWidth: 0 }}>
        <section
          style={{
            padding: "1rem 1.1rem",
            borderRadius: "20px",
            background: "linear-gradient(145deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), var(--surface))",
            border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
            display: "grid",
            gap: "0.9rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "0.25rem", maxWidth: "54ch" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
                {focusRunway.eyebrow}
              </span>
              <strong style={{ fontSize: "var(--text-lg)" }}>{focusRunway.title}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {focusRunway.body}
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={focusRunway.primaryAction}
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
                {focusRunway.primaryLabel}
              </button>
              <button
                onClick={focusRunway.secondaryAction}
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
                {focusRunway.secondaryLabel}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem", position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Today
              </span>
              <strong style={{ fontSize: "1.35rem" }}>{focusMinutesToday}m</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                completed focus time
              </span>
            </div>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem", position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Sessions
              </span>
              <strong style={{ fontSize: "1.35rem" }}>{todayCompletedSessions.length}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                blocks finished today
              </span>
            </div>
            <div style={{ padding: "0.8rem 0.9rem", borderRadius: "16px", background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "var(--surface-glass-blur, blur(14px))", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem", position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
              <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Target
              </span>
              <strong style={{ fontSize: "var(--text-base)" }}>
                {activeTask?.title ?? selectedTask?.title ?? "Choose one"}
              </strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {activeTask ? "current session target" : selectedTask ? "ready for the next block" : "no task linked yet"}
              </span>
            </div>
          </div>
        </section>
        {breakEndsAt && (
          <BreakTimerBanner breakEndsAt={breakEndsAt} onDismiss={handleDismissBreak} />
        )}
        <FocusPanel
          isActive={Boolean(activeSession)}
          onStart={(minutes) => void start(selectedTaskId || undefined, minutes)}
          tasks={app.tasks.tasks}
          onTaskSelect={setSelectedTaskId}
        />
        <FocusTimer
          session={activeSession}
          onPause={() => void control("paused")}
          onResume={() => void control("running")}
          onComplete={() => void handleSessionComplete()}
        />
      </div>
      <SessionHistory sessions={sessions} />

      {showComplete && (
        <FocusCompleteModal
          durationMinutes={completedDuration}
          taskTitle={completedTaskTitle}
          onLogToTask={() => void handleLogToTask()}
          onStartAnother={() => void handleStartAnotherFocus()}
          onStartBreak={handleStartBreak}
          onDismiss={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
