import { useState } from "react";

import type { Habit, Task } from "@shared/types";

import { ShutdownDeferStep } from "./ShutdownDeferStep";
import { ShutdownJournalPrompt } from "./ShutdownJournalPrompt";
import {
  STEP_TITLES,
  TOTAL_STEPS,
  primaryBtn,
  secondaryBtn,
} from "./ShutdownShared";
import { ShutdownStepDots } from "./ShutdownStepDots";
import { ShutdownWinStrip } from "./ShutdownWinStrip";

interface ShutdownModalProps {
  completedToday: Task[];
  incompleteToday: Task[];
  tomorrowTasks: Task[];
  habits: Habit[];
  onHabitCheckIn: (id: string) => void;
  onDefer: (
    taskId: string,
    when: "tomorrow" | "this_week" | "drop",
  ) => Promise<void> | void;
  onJournalNote: (emoji: string, note: string) => Promise<void> | void;
  onClose: () => void;
}

interface ShutdownStateCopy {
  eyebrow: string;
  title: string;
  body: string;
}

function getShutdownState(
  incompleteToday: Task[],
  tomorrowTasks: Task[],
): ShutdownStateCopy {
  if (incompleteToday.length > 0) {
    return {
      eyebrow: "Still open",
      title: `${incompleteToday.length} task${incompleteToday.length === 1 ? "" : "s"} still need a decision`,
      body: "Use this ritual to reduce spillover now so tomorrow starts lighter.",
    };
  }
  if (tomorrowTasks.length > 0) {
    return {
      eyebrow: "Runway set",
      title: "The next day already has a starting line",
      body: "You can finish the day by checking the emotional note and leaving the plan intact.",
    };
  }
  return {
    eyebrow: "Clean slate",
    title: "You have room to set tomorrow up calmly",
    body: "Nothing urgent is hanging over you. Use the last step to leave a clear emotional note and stop for real.",
  };
}

export default function ShutdownModal({
  completedToday,
  incompleteToday,
  tomorrowTasks,
  habits,
  onHabitCheckIn,
  onDefer,
  onJournalNote,
  onClose,
}: ShutdownModalProps): JSX.Element {
  const [step, setStep] = useState(0);
  const [decisions, setDecisions] = useState<
    Record<string, "tomorrow" | "this_week" | "drop">
  >({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const shutdownState = getShutdownState(incompleteToday, tomorrowTasks);
  const deferredCount = Object.values(decisions).filter(
    (decision) => decision !== "drop",
  ).length;
  const droppedCount = Object.values(decisions).filter(
    (decision) => decision === "drop",
  ).length;

  const projectedTomorrowTasks = [
    ...tomorrowTasks,
    ...incompleteToday.filter((task) => {
      const decision = decisions[task.id] ?? "tomorrow";
      return decision === "tomorrow";
    }),
  ].filter(
    (task, index, items) =>
      items.findIndex((candidate) => candidate.id === task.id) === index,
  );

  const handleDecide = (
    taskId: string,
    when: "tomorrow" | "this_week" | "drop",
  ): void => {
    setDecisions((prev) => ({ ...prev, [taskId]: when }));
  };

  const handleAdvanceFromDefer = (): void => {
    const next = { ...decisions };
    for (const task of incompleteToday) {
      if (!next[task.id]) {
        next[task.id] = "tomorrow";
      }
    }
    setDecisions(next);
    setStep(3);
  };

  const completedHabits = habits.filter(
    (h) => (h.today_count ?? 0) >= h.target_freq,
  );

  const handleJournalSubmit = async (
    emoji: string,
    note: string,
  ): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      for (const task of incompleteToday) {
        await onDefer(task.id, decisions[task.id] ?? "tomorrow");
      }
      await onJournalNote(emoji, note);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Shutdown could not be saved. Try again.",
      );
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = (): void => {
    setCompleted(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="End your day"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 10, 14, 0.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%), var(--surface))",
          borderRadius: "28px",
          padding: "1.2rem 1.25rem 1.35rem",
          boxShadow: "var(--shadow-floating)",
          border: "1px solid var(--border-subtle)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "grid",
            gap: "0.95rem",
            padding: "0.45rem 0.35rem 1rem",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.75rem",
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
                Evening ritual
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: "clamp(1.25rem, 2vw, 1.6rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                End your day
              </h2>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                {completed ? "Complete" : STEP_TITLES[step]}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 800,
                lineHeight: 1,
                width: "36px",
                height: "36px",
                borderRadius: "12px",
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              padding: "0.8rem 0.9rem",
              borderRadius: "16px",
              background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gap: "0.4rem",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 800,
              }}
            >
              {shutdownState.eyebrow}
            </span>
            <strong style={{ fontSize: "var(--text-base)" }}>
              {shutdownState.title}
            </strong>
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {shutdownState.body}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem 0.85rem",
                borderRadius: "14px",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gap: "0.15rem",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                }}
              >
                Completed
              </span>
              <strong style={{ fontSize: "1.2rem" }}>
                {completedToday.length}
              </strong>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                completed today
              </span>
            </div>
            <div
              style={{
                padding: "0.75rem 0.85rem",
                borderRadius: "14px",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gap: "0.15rem",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                }}
              >
                Carryover
              </span>
              <strong style={{ fontSize: "1.2rem" }}>
                {incompleteToday.length}
              </strong>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                still unresolved
              </span>
            </div>
            <div
              style={{
                padding: "0.75rem 0.85rem",
                borderRadius: "14px",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gap: "0.15rem",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                }}
              >
                Habits
              </span>
              <strong style={{ fontSize: "1.2rem" }}>
                {completedHabits.length}/{habits.length}
              </strong>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                }}
              >
                habits hit today
              </span>
            </div>
          </div>
        </div>

        {!completed && <ShutdownStepDots step={step} total={TOTAL_STEPS} />}

        {completed ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div
              style={{
                padding: "1rem",
                borderRadius: "16px",
                background:
                  "color-mix(in srgb, var(--state-completed) 8%, var(--surface))",
                border:
                  "1px solid color-mix(in srgb, var(--state-completed) 20%, var(--border-subtle))",
                display: "grid",
                gap: "0.45rem",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--state-completed)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 800,
                }}
              >
                Shutdown complete
              </span>
              <strong style={{ fontSize: "var(--text-lg)" }}>
                Tomorrow is set and today is closed.
              </strong>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {deferredCount > 0
                  ? `${deferredCount} task${deferredCount === 1 ? "" : "s"} moved into tomorrow's runway.`
                  : "No carry-forward tasks were added to tomorrow."}{" "}
                {droppedCount > 0
                  ? `${droppedCount} task${droppedCount === 1 ? "" : "s"} dropped from the plan.`
                  : ""}
              </span>
            </div>

            <div
              style={{
                padding: "0.85rem 0.95rem",
                borderRadius: "14px",
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              <strong style={{ fontSize: "var(--text-sm)" }}>
                Tomorrow lineup
              </strong>
              {projectedTomorrowTasks.length === 0 ? (
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Nothing scheduled yet.
                </span>
              ) : (
                projectedTomorrowTasks.slice(0, 5).map((task) => (
                  <span
                    key={task.id}
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {task.title}
                  </span>
                ))
              )}
            </div>

            <button onClick={onClose} style={{ ...primaryBtn, width: "100%" }}>
              Close shutdown
            </button>
          </div>
        ) : (
          <>
            {step === 0 && (
              <ShutdownWinStrip
                completedToday={completedToday}
                onNext={(_highlighted) => setStep(1)}
              />
            )}
            {step === 1 && (
              <div style={{ display: "grid", gap: "0.65rem" }}>
                {habits.length === 0 ? (
                  <div
                    style={{
                      padding: "1rem",
                      borderRadius: "14px",
                      background: "var(--surface-2)",
                      border: "1px dashed var(--border-subtle)",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      No habits to track
                    </span>
                  </div>
                ) : (
                  habits.map((habit) => {
                    const count = habit.today_count ?? 0;
                    const target = habit.target_freq;
                    const done = count >= target;
                    return (
                      <div
                        key={habit.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          padding: "0.55rem 0.75rem",
                          borderRadius: "10px",
                          background: done
                            ? "color-mix(in srgb, var(--state-completed) 6%, transparent)"
                            : "var(--surface-2)",
                          border: done
                            ? "1px solid color-mix(in srgb, var(--state-completed) 20%, transparent)"
                            : "1px solid transparent",
                        }}
                      >
                        <span
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "999px",
                            border: `2px solid ${done ? "var(--state-completed)" : "var(--accent)"}`,
                            background: done
                              ? "var(--state-completed)"
                              : "transparent",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          {done && (
                            <span
                              style={{
                                fontSize: "0.55rem",
                                color: "white",
                                fontWeight: 800,
                              }}
                            >
                              &#10003;
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: "var(--text-sm)",
                            opacity: done ? 0.65 : 1,
                          }}
                        >
                          {habit.name}
                          {target > 1 && (
                            <span
                              style={{
                                marginLeft: "0.35rem",
                                fontSize: "var(--text-xs)",
                                color: "var(--text-muted)",
                                fontWeight: 600,
                              }}
                            >
                              {count}/{target}
                            </span>
                          )}
                        </span>
                        {!done && (
                          <button
                            onClick={() => onHabitCheckIn(habit.id)}
                            style={{
                              padding: "0.25rem 0.65rem",
                              borderRadius: "8px",
                              border: "1px solid var(--accent)",
                              background: "transparent",
                              color: "var(--accent)",
                              fontSize: "var(--text-xs)",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            +1
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setStep(0)}
                    style={{ ...secondaryBtn }}
                  >
                    Back
                  </button>
                  <button onClick={() => setStep(2)} style={{ ...primaryBtn }}>
                    Continue
                  </button>
                </div>
              </div>
            )}
            {step === 2 && (
              <ShutdownDeferStep
                incompleteToday={incompleteToday}
                decisions={decisions}
                onDecide={handleDecide}
                onNext={handleAdvanceFromDefer}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <ShutdownJournalPrompt
                tomorrowTasks={projectedTomorrowTasks}
                saving={saving}
                error={saveError}
                onJournalNote={handleJournalSubmit}
                onBack={() => {
                  setSaveError(null);
                  setStep(2);
                }}
                onFinish={handleFinish}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
