import { useState } from "react";

import type { Task } from "@shared/types";

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

const secondaryBtn: React.CSSProperties = {
  padding: "0.72rem 1rem",
  borderRadius: "12px",
  border: "1px solid var(--border-subtle)",
  background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

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

// ── Step 0: Win strip ──────────────────────────────────────────────────────────

function WinStrip({
  completedToday,
  onNext,
}: {
  completedToday: Task[];
  onNext: (highlighted: Set<string>) => void;
}): JSX.Element {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const toggleWin = (id: string): void => {
    setHighlighted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0, marginBottom: "1.25rem" }}>
        What did you actually get done today?
      </p>
      {completedToday.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            borderRadius: "14px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border-subtle)",
            marginBottom: "1.5rem",
            display: "grid",
            gap: "0.35rem",
            textAlign: "center",
          }}
        >
          <strong style={{ fontSize: "var(--text-sm)" }}>Nothing logged today</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            That's okay — showing up still counts. The next block starts fresh.
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.4rem", marginBottom: "1.5rem" }}>
          {completedToday.map((task) => (
            <button
              key={task.id}
              onClick={() => toggleWin(task.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.65rem 0.85rem",
                borderRadius: "12px",
                border: "1px solid",
                borderColor: highlighted.has(task.id) ? "var(--accent)" : "var(--border-subtle)",
                background: highlighted.has(task.id)
                  ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                  : "var(--surface-2)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <span
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "color-mix(in srgb, var(--state-ok, #10b981) 12%, transparent)",
                  color: "var(--state-ok, #10b981)",
                  fontSize: "0.75rem",
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span style={{ flex: 1, fontSize: "var(--text-sm)" }}>{task.title}</span>
              {highlighted.has(task.id) && (
                <span
                  style={{
                    padding: "0.18rem 0.42rem",
                    borderRadius: "999px",
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--accent)",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                  }}
                >
                  ★ win
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => onNext(highlighted)}
        style={{
          ...primaryBtn,
          width: "100%",
        }}
      >
        Continue
      </button>
    </div>
  );
}

// ── Step 1: Defer incomplete ───────────────────────────────────────────────────

function Defer({
  incompleteToday,
  onDefer,
  onNext,
  onBack,
}: {
  incompleteToday: Task[];
  onDefer: (taskId: string, when: "tomorrow" | "this_week" | "drop") => void;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const [decisions, setDecisions] = useState<Record<string, "tomorrow" | "this_week" | "drop">>({});

  const allDecided = incompleteToday.length === 0 || incompleteToday.every((t) => decisions[t.id]);

  const handleDecide = (id: string, when: "tomorrow" | "this_week" | "drop"): void => {
    setDecisions((prev) => ({ ...prev, [id]: when }));
    onDefer(id, when);
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0, marginBottom: "1.25rem" }}>
        What didn't get done?
      </p>
      {incompleteToday.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            borderRadius: "14px",
            background: "color-mix(in srgb, var(--state-completed) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--state-completed) 20%, transparent)",
            marginBottom: "1.5rem",
            display: "grid",
            gap: "0.35rem",
            textAlign: "center",
          }}
        >
          <strong style={{ fontSize: "var(--text-sm)", color: "var(--state-completed)" }}>
            Clean close
          </strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Nothing left hanging. Tomorrow starts with a clear runway.
          </span>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {incompleteToday.map((task) => {
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
                  {(["tomorrow", "this_week", "drop"] as const).map((action) => (
                    <button
                      key={action}
                      onClick={() => handleDecide(task.id, action)}
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
                      {action === "tomorrow" ? "Tomorrow" : action === "this_week" ? "This week" : "Drop"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onBack}
          style={secondaryBtn}
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!allDecided}
          style={{
            flex: 1,
            ...primaryBtn,
            background: allDecided ? primaryBtn.background : "var(--border-subtle)",
            color: "var(--text-inverted)",
            cursor: allDecided ? "pointer" : "not-allowed",
            opacity: allDecided ? 1 : 0.5,
            boxShadow: allDecided ? "var(--shadow-soft)" : "none",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Tomorrow preview + journal ──────────────────────────────────────────

// emoji field is stored in the journal — use real emoji values so the journal
// can render them directly without a lookup table.
const EMOJI_CHOICES = [
  { emoji: "😤", label: "Rough" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😐", label: "Okay" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😄", label: "Great" },
  { emoji: "🤩", label: "Amazing" },
] as const;

function JournalPrompt({
  tomorrowTasks,
  onJournalNote,
  onBack,
  onClose,
}: {
  tomorrowTasks: Task[];
  onJournalNote: (emoji: string, note: string) => void;
  onBack: () => void;
  onClose: () => void;
}): JSX.Element {
  const [emoji, setEmoji] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");

  const handleSubmit = (): void => {
    if (emoji) {
      onJournalNote(emoji, note);
    }
    onClose();
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0, marginBottom: "1rem" }}>
        Tomorrow's lineup
      </p>
      {tomorrowTasks.length === 0 ? (
        <div style={{ padding: "0.5rem 0.75rem", borderRadius: "10px", background: "var(--surface-2)", marginBottom: "1.5rem", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          No scheduled tasks for tomorrow yet.
        </div>
      ) : (
        <div style={{ padding: "0.5rem 0.75rem", borderRadius: "10px", background: "var(--surface-2)", marginBottom: "1.5rem", display: "grid", gap: "0.3rem" }}>
          {tomorrowTasks.slice(0, 5).map((task) => (
            <div key={task.id} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>→</span>
              <span>{task.title}</span>
            </div>
          ))}
          {tomorrowTasks.length > 5 && (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              +{tomorrowTasks.length - 5} more
            </div>
          )}
        </div>
      )}

      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0, marginBottom: "0.75rem" }}>
        How did today feel?
      </p>

      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {EMOJI_CHOICES.map((choice) => (
          <button
            key={choice.emoji}
            onClick={() => setEmoji(choice.emoji)}
            style={{
              minWidth: "68px",
              padding: "0.6rem 0.65rem",
              borderRadius: "10px",
              border: "1.5px solid",
              borderColor: emoji === choice.emoji ? "var(--accent)" : "var(--border-subtle)",
              background: emoji === choice.emoji ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-2)",
              cursor: "pointer",
              transition: "border-color 120ms, background 120ms",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.28rem",
            }}
            title={choice.label}
            aria-label={choice.label}
            aria-pressed={emoji === choice.emoji}
          >
            <span style={{ fontSize: "1.35rem", lineHeight: 1 }}>{choice.emoji}</span>
            <span style={{ fontSize: "10px", color: "var(--text-secondary)", fontWeight: 600 }}>{choice.label}</span>
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="(Optional) Any thoughts?"
        style={{
          width: "100%",
          padding: "0.75rem",
          borderRadius: "10px",
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-2)",
          color: "var(--text)",
          fontSize: "var(--text-sm)",
          fontFamily: "inherit",
          resize: "vertical",
          minHeight: "70px",
          marginBottom: "1.5rem",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onBack}
          style={secondaryBtn}
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!emoji}
          style={{
            flex: 1,
            ...primaryBtn,
            background: emoji ? primaryBtn.background : "var(--border-subtle)",
            color: "var(--text-inverted)",
            cursor: emoji ? "pointer" : "not-allowed",
            opacity: emoji ? 1 : 0.5,
            boxShadow: emoji ? "var(--shadow-soft)" : "none",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface ShutdownModalProps {
  completedToday: Task[];
  incompleteToday: Task[];
  tomorrowTasks: Task[];
  onDefer: (taskId: string, when: "tomorrow" | "this_week" | "drop") => void;
  onJournalNote: (emoji: string, note: string) => void;
  onClose: () => void;
}

const STEP_TITLES = ["Wins", "Defer", "Tomorrow"];
const TOTAL_STEPS = 3;

export default function ShutdownModal({
  completedToday,
  incompleteToday,
  tomorrowTasks,
  onDefer,
  onJournalNote,
  onClose,
}: ShutdownModalProps): JSX.Element {
  const [step, setStep] = useState(0);
  const shutdownState = (() => {
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
        title: "Tomorrow already has a starting line",
        body: "You can finish the day by checking the emotional note and leaving the plan intact.",
      };
    }
    return {
      eyebrow: "Clean slate",
      title: "You have room to set tomorrow up calmly",
      body: "Nothing urgent is hanging over you. Use the last step to leave a clear emotional note and stop for real.",
    };
  })();

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
              Evening ritual
            </span>
            <h2 style={{ margin: 0, fontSize: "clamp(1.25rem, 2vw, 1.6rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>End your day</h2>
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
            display: "grid",
            gap: "0.4rem",
          }}
        >
          <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
            {shutdownState.eyebrow}
          </span>
          <strong style={{ fontSize: "var(--text-base)" }}>{shutdownState.title}</strong>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {shutdownState.body}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
          <div style={{ padding: "0.75rem 0.85rem", borderRadius: "14px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              Wins
            </span>
            <strong style={{ fontSize: "1.2rem" }}>{completedToday.length}</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              completed today
            </span>
          </div>
          <div style={{ padding: "0.75rem 0.85rem", borderRadius: "14px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              Carryover
            </span>
            <strong style={{ fontSize: "1.2rem" }}>{incompleteToday.length}</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              still unresolved
            </span>
          </div>
          <div style={{ padding: "0.75rem 0.85rem", borderRadius: "14px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              Tomorrow
            </span>
            <strong style={{ fontSize: "1.2rem" }}>{tomorrowTasks.length}</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              tasks already lined up
            </span>
          </div>
        </div>
        </div>

        <StepDots step={step} total={TOTAL_STEPS} />

        {step === 0 && (
          <WinStrip
            completedToday={completedToday}
            onNext={(_highlighted) => setStep(1)}
          />
        )}
        {step === 1 && (
          <Defer
            incompleteToday={incompleteToday}
            onDefer={onDefer}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <JournalPrompt
            tomorrowTasks={tomorrowTasks}
            onJournalNote={onJournalNote}
            onBack={() => setStep(1)}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
