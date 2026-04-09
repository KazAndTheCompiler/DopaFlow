import { useState } from "react";

import type { Task } from "@shared/types";

import { ShutdownDeferStep } from "./ShutdownDeferStep";
import { ShutdownJournalPrompt } from "./ShutdownJournalPrompt";
import { STEP_TITLES, TOTAL_STEPS } from "./ShutdownShared";
import { ShutdownStepDots } from "./ShutdownStepDots";
import { ShutdownWinStrip } from "./ShutdownWinStrip";

interface ShutdownModalProps {
  completedToday: Task[];
  incompleteToday: Task[];
  tomorrowTasks: Task[];
  onDefer: (taskId: string, when: "tomorrow" | "this_week" | "drop") => void;
  onJournalNote: (emoji: string, note: string) => void;
  onClose: () => void;
}

interface ShutdownStateCopy {
  eyebrow: string;
  title: string;
  body: string;
}

function getShutdownState(incompleteToday: Task[], tomorrowTasks: Task[]): ShutdownStateCopy {
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
  onDefer,
  onJournalNote,
  onClose,
}: ShutdownModalProps): JSX.Element {
  const [step, setStep] = useState(0);
  const shutdownState = getShutdownState(incompleteToday, tomorrowTasks);

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
              <h2 style={{ margin: 0, fontSize: "clamp(1.25rem, 2vw, 1.6rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
                End your day
              </h2>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{STEP_TITLES[step]}</span>
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
            <strong style={{ fontSize: "var(--text-base)" }}>{shutdownState.title}</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {shutdownState.body}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
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
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Completed
              </span>
              <strong style={{ fontSize: "1.2rem" }}>{completedToday.length}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>completed today</span>
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
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Carryover
              </span>
              <strong style={{ fontSize: "1.2rem" }}>{incompleteToday.length}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>still unresolved</span>
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
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Planned
              </span>
              <strong style={{ fontSize: "1.2rem" }}>{tomorrowTasks.length}</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>tasks already lined up</span>
            </div>
          </div>
        </div>

        <ShutdownStepDots step={step} total={TOTAL_STEPS} />

        {step === 0 && <ShutdownWinStrip completedToday={completedToday} onNext={(_highlighted) => setStep(1)} />}
        {step === 1 && <ShutdownDeferStep incompleteToday={incompleteToday} onDefer={onDefer} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <ShutdownJournalPrompt tomorrowTasks={tomorrowTasks} onJournalNote={onJournalNote} onBack={() => setStep(1)} onClose={onClose} />}
      </div>
    </div>
  );
}
