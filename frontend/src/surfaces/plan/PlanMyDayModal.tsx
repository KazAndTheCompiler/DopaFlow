import { useContext, useEffect, useState } from "react";

import type { Task } from "@shared/types";
import { AppDataContext } from "../../App";

const TODAY_KEY = "zoestm_planned_date";
const MAX_PICKS = 3;

const ENERGY_LEVELS = [
  { code: "😓", label: "Drained", value: 0 },
  { code: "😐", label: "Low", value: 1 },
  { code: "🙂", label: "Okay", value: 2 },
  { code: "😄", label: "Good", value: 3 },
  { code: "⚡", label: "Peak", value: 4 },
] as const;

const primaryBtn: React.CSSProperties = {
  padding: "0.72rem 1.25rem",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))",
  color: "var(--text-inverted)",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "var(--text-sm)",
  boxShadow: "var(--shadow-soft)",
};

const disabledBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "var(--border-subtle)",
  cursor: "not-allowed",
  opacity: 0.5,
  boxShadow: "none",
};

const ghostBtn: React.CSSProperties = {
  padding: "0.72rem 1rem",
  borderRadius: "12px",
  border: "1px solid var(--border-subtle)",
  background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function isOverdue(task: Task): boolean {
  if (!task.due_at) return false;
  return task.due_at.slice(0, 10) < todayISO();
}

// ── Step dots ──────────────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", marginBottom: "1.5rem" }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 20 : 8,
            height: 8,
            borderRadius: 999,
            background: i < step
              ? "color-mix(in srgb, var(--accent) 45%, transparent)"
              : i === step
              ? "var(--accent)"
              : "var(--border)",
            transition: "width 200ms ease, background 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

// ── Step 0: Energy check ───────────────────────────────────────────────────────

function EnergyCheck({
  energy,
  onPick,
  onNext,
}: {
  energy: number | null;
  onPick: (v: number) => void;
  onNext: () => void;
}): JSX.Element {
  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0, marginBottom: "1.25rem" }}>
        How's your energy right now?
      </p>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level.value}
            onClick={() => onPick(level.value)}
            style={{
              flex: 1,
              padding: "0.65rem 0.25rem",
              borderRadius: "12px",
              border: "1.5px solid",
              borderColor: energy === level.value ? "var(--accent)" : "var(--border-subtle)",
              background: energy === level.value
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "var(--surface-2)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
              transition: "border-color 120ms, background 120ms",
            }}
          >
            <span
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "14px",
                display: "grid",
                placeItems: "center",
                background: energy === level.value ? "color-mix(in srgb, var(--accent) 15%, var(--surface))" : "var(--surface)",
                fontSize: "1.3rem",
                lineHeight: 1,
              }}
            >
              {level.code}
            </span>
            <span style={{
              fontSize: "10px",
              color: energy === level.value ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: energy === level.value ? 700 : 400,
            }}>
              {level.label}
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={energy === null}
        style={energy !== null ? primaryBtn : disabledBtn}
      >
        Continue
      </button>
    </div>
  );
}

// ── Step 1: Yesterday's wins + Carry forward ───────────────────────────────────

function CarryForward({
  overdue,
  decisions,
  yesterdayStats,
  onDecide,
  onNext,
  onBack,
}: {
  overdue: Task[];
  decisions: Record<string, "keep" | "postpone" | "drop">;
  yesterdayStats: { tasks: number; focusMin: number; streak: number };
  onDecide: (id: string, d: "keep" | "postpone" | "drop") => void;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const allDecided = overdue.length === 0 || overdue.every((t) => decisions[t.id]);

  const statItems = [
    { label: "tasks completed", value: yesterdayStats.tasks },
    { label: "focus minutes", value: yesterdayStats.focusMin },
    { label: "day streak", value: yesterdayStats.streak },
  ].filter((s) => s.value > 0);

  return (
    <div>
      {/* Yesterday strip */}
      {statItems.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            padding: "0.65rem 0.9rem",
            borderRadius: "12px",
            background: "color-mix(in srgb, var(--state-ok, #10b981) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--state-ok, #10b981) 20%, transparent)",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, alignSelf: "center" }}>
            Yesterday
          </span>
          {statItems.map((s) => (
            <span key={s.label} style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text)" }}>
              {s.value}
              <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-secondary)", marginLeft: "0.2rem" }}>
                {s.label}
              </span>
            </span>
          ))}
        </div>
      )}

      {overdue.length === 0 ? (
        <div style={{ textAlign: "center", padding: "0.75rem 0 1.25rem" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              margin: "0 auto 0.55rem",
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              background: "color-mix(in srgb, var(--state-ok, #10b981) 12%, transparent)",
              color: "var(--state-ok, #10b981)",
              fontSize: "1.2rem",
            }}
          >
            ✓
          </div>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "var(--text-sm)" }}>
            Clean slate. No carryover from yesterday.
          </p>
        </div>
      ) : (
        <>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
            These didn't get done. Decide before you plan today.
          </p>
          <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
            {overdue.map((task) => {
              const d = decisions[task.id];
              return (
                <div
                  key={task.id}
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: "12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-subtle)",
                    display: "grid",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{task.title}</span>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {(["keep", "postpone", "drop"] as const).map((action) => (
                      <button
                        key={action}
                        onClick={() => onDecide(task.id, action)}
                        style={{
                          padding: "0.3rem 0.65rem",
                          borderRadius: "8px",
                          border: "1.5px solid",
                          borderColor: d === action ? "var(--accent)" : "var(--border-subtle)",
                          background: d === action ? "var(--accent)" : "transparent",
                          color: d === action ? "var(--text-inverted)" : "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {action === "keep" ? "Keep today" : action === "postpone" ? "Tomorrow" : "Drop"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={onBack} style={ghostBtn}>Back</button>
        <button
          onClick={onNext}
          disabled={!allDecided}
          style={{ ...(allDecided ? primaryBtn : disabledBtn), flex: 1 }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Pick your 3 + today's schedule ─────────────────────────────────────

function PickThree({
  pending,
  picks,
  todayEvents,
  onToggle,
  onNext,
  onBack,
}: {
  pending: Task[];
  picks: Set<string>;
  todayEvents: Array<{ title: string; start_at: string }>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const PRIORITY_DOT: Record<number, string> = {
    1: "var(--state-overdue)",
    2: "var(--state-warn)",
    3: "var(--accent)",
    4: "var(--text-secondary)",
    5: "var(--border)",
  };

  const fmtTime = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <div>
      {/* Today's schedule strip */}
      {todayEvents.length > 0 && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "10px",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "0.85rem",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>TODAY</span>
          {todayEvents.slice(0, 4).map((ev, i) => (
            <span
              key={i}
              style={{
                fontSize: "11px",
                color: "var(--text)",
                background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                borderRadius: "6px",
                padding: "0.15rem 0.45rem",
              }}
            >
              {fmtTime(ev.start_at)} {ev.title}
            </span>
          ))}
          {todayEvents.length > 4 && (
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              +{todayEvents.length - 4} more
            </span>
          )}
        </div>
      )}

      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
        Pick up to {MAX_PICKS}. These are your commitments.
      </p>

      <div
        style={{
          display: "grid",
          gap: "0.4rem",
          maxHeight: "280px",
          overflowY: "auto",
          marginBottom: "1.25rem",
          paddingRight: "0.25rem",
        }}
      >
        {pending.length === 0 && (
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", textAlign: "center", padding: "1rem 0" }}>
            Nothing to pick — you're done.
          </p>
        )}
        {pending.map((task) => {
          const selected = picks.has(task.id);
          const atMax = picks.size >= MAX_PICKS && !selected;
          return (
            <button
              key={task.id}
              onClick={() => !atMax && onToggle(task.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.6rem 0.85rem",
                borderRadius: "12px",
                border: "1.5px solid",
                borderColor: selected ? "var(--accent)" : "var(--border-subtle)",
                background: selected
                  ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                  : "var(--surface-2)",
                cursor: atMax ? "not-allowed" : "pointer",
                opacity: atMax ? 0.4 : 1,
                textAlign: "left",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: PRIORITY_DOT[task.priority] ?? "var(--border)",
                }}
              />
              <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: selected ? 600 : 400 }}>
                {task.title}
              </span>
              {task.estimated_minutes != null && (
                <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                  {task.estimated_minutes}m
                </span>
              )}
              {selected && (
                <span style={{ fontSize: "0.8rem", color: "var(--accent)" }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button onClick={onBack} style={ghostBtn}>Back</button>
        <span style={{ flex: 1, fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
          {picks.size}/{MAX_PICKS} picked
        </span>
        <button onClick={onNext} style={primaryBtn}>Continue</button>
      </div>
    </div>
  );
}

// ── Step 3: Commit ─────────────────────────────────────────────────────────────

function Commit({
  picks,
  tasks,
  whisper,
  energy,
  onStartTasks,
  onStartFocus,
  onBack,
}: {
  picks: Set<string>;
  tasks: Task[];
  whisper: string;
  energy: number | null;
  onStartTasks: () => void;
  onStartFocus: (taskTitle: string) => void;
  onBack: () => void;
}): JSX.Element {
  const pickedTasks = tasks.filter((t) => picks.has(t.id));
  const firstTask = pickedTasks[0];
  const energyLevel = energy !== null ? ENERGY_LEVELS[energy] : null;

  return (
    <div>
      {energyLevel && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
        }}>
          <span
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              background: "var(--surface-2)",
              fontSize: "1rem",
              lineHeight: 1,
            }}
          >
            {energyLevel.code}
          </span>
          <span>Starting at <strong style={{ color: "var(--text)" }}>{energyLevel.label}</strong> energy</span>
        </div>
      )}

      {pickedTasks.length > 0 ? (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
            Today's commitments
          </span>
          {pickedTasks.map((task, i) => (
            <div
              key={task.id}
              style={{
                display: "flex",
                gap: "0.65rem",
                alignItems: "center",
                padding: "0.6rem 0.85rem",
                borderRadius: "12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "var(--text-inverted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: "var(--text-sm)", fontWeight: 500 }}>{task.title}</span>
              {task.estimated_minutes != null && (
                <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                  {task.estimated_minutes}m
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "1.25rem" }}>
          Nothing picked — give yourself a break.
        </p>
      )}

      {whisper && (
        <div
          style={{
            padding: "0.65rem 1rem",
            borderRadius: "12px",
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            fontStyle: "italic",
            marginBottom: "1.25rem",
          }}
        >
          Packy: {whisper}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
        {firstTask && (
          <button
            onClick={() => onStartFocus(firstTask.title)}
            style={{
              ...primaryBtn,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
            }}
          >
            <span>⏱ Start focus on "{firstTask.title}"</span>
          </button>
        )}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={onBack} style={ghostBtn}>Back</button>
          <button onClick={onStartTasks} style={{ ...ghostBtn, flex: 1, borderColor: "var(--border)" }}>
            View tasks
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface PlanMyDayModalProps {
  onClose: () => void;
  onNavigate: (route: string) => void;
}

const STEP_TITLES = ["Energy", "Yesterday", "Pick your 3", "Commit"];
const TOTAL_STEPS = 4;

export default function PlanMyDayModal({ onClose, onNavigate }: PlanMyDayModalProps): JSX.Element | null {
  const app = useContext(AppDataContext);
  const [step, setStep] = useState(0);
  const [energy, setEnergy] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "keep" | "postpone" | "drop">>({});
  const [picks, setPicks] = useState<Set<string>>(new Set());

  const tasks = app?.tasks.tasks ?? [];
  const overdue = tasks.filter(
    (t) => !t.done && t.status !== "cancelled" && t.status !== "done" && isOverdue(t),
  );

  // Pre-select top 3 by priority when entering step 2
  useEffect(() => {
    if (step === 2) {
      const pre = tasks
        .filter((t) => !t.done && t.status !== "cancelled" && t.status !== "done" && !isOverdue(t))
        .sort((a, b) => a.priority - b.priority)
        .slice(0, MAX_PICKS);
      setPicks(new Set(pre.map((t) => t.id)));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!app) return null;

  // Yesterday's stats
  const yISO = yesterdayISO();
  const yesterdayTasks = tasks.filter(
    (t) => t.done && (t as { updated_at?: string }).updated_at?.slice(0, 10) === yISO,
  ).length;
  const yesterdayFocus = (app.focus.sessions ?? [])
    .filter((s) => s.status === "completed" && (s as { ended_at?: string }).ended_at?.slice(0, 10) === yISO)
    .reduce((sum, s) => sum + ((s as { duration_minutes?: number }).duration_minutes ?? 0), 0);
  const habitStreak = (app.habits.habits ?? []).reduce(
    (max, h) => Math.max(max, h.current_streak ?? 0), 0,
  );

  // Today's events
  const todayEvents = (app.calendar.events ?? [])
    .filter((e) => e.start_at?.slice(0, 10) === todayISO())
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const pending = tasks
    .filter((t) => !t.done && t.status !== "cancelled" && t.status !== "done" && !isOverdue(t))
    .sort((a, b) => a.priority - b.priority);

  const handleDecide = (id: string, d: "keep" | "postpone" | "drop"): void => {
    setDecisions((prev) => ({ ...prev, [id]: d }));
  };

  const handleTogglePick = (id: string): void => {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_PICKS) {
        next.add(id);
      }
      return next;
    });
  };

  const applyDecisions = async (): Promise<void> => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomorrowISO = tom.toISOString().slice(0, 10);
    for (const [id, decision] of Object.entries(decisions)) {
      if (decision === "drop") {
        await app.tasks.update(id, { status: "cancelled" });
      } else if (decision === "postpone") {
        await app.tasks.update(id, { due_at: tomorrowISO });
      }
    }
  };

  const complete = async (dest: "tasks" | "focus", focusTitle?: string): Promise<void> => {
    await applyDecisions();
    if (energy !== null) {
      const level = ENERGY_LEVELS[energy];
      void app.packy.updateLorebook(
        `Energy: ${level.label}`,
        `Morning energy logged as ${level.label} (${level.value}/4)`,
      );
    }
    localStorage.setItem(TODAY_KEY, todayISO());
    if (dest === "focus" && focusTitle) {
      localStorage.setItem("zoestm_focus_prefill", focusTitle);
    }
    onNavigate(dest);
    onClose();
  };

  const whisper = app.packy.whisper?.text ?? "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Plan my day"
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
          background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%), var(--surface))",
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Daily ritual
            </span>
            <h2 style={{ margin: 0, fontSize: "clamp(1.25rem, 2vw, 1.6rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>Plan my day</h2>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {STEP_TITLES[step]}
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
          }}
        >
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Set your energy, clear yesterday’s leftovers, choose the real commitments, then start the day with intention.
          </span>
        </div>
        </div>

        <StepDots step={step} total={TOTAL_STEPS} />

        {step === 0 && (
          <EnergyCheck
            energy={energy}
            onPick={(v) => { setEnergy(v); }}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <CarryForward
            overdue={overdue}
            decisions={decisions}
            yesterdayStats={{ tasks: yesterdayTasks, focusMin: yesterdayFocus, streak: habitStreak }}
            onDecide={handleDecide}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <PickThree
            pending={pending}
            picks={picks}
            todayEvents={todayEvents}
            onToggle={handleTogglePick}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Commit
            picks={picks}
            tasks={tasks}
            whisper={whisper}
            energy={energy}
            onStartTasks={() => void complete("tasks")}
            onStartFocus={(title) => void complete("focus", title)}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
