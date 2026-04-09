import { useState } from "react";

import type { Task } from "@shared/types";

import { EMOJI_CHOICES, primaryBtn, secondaryBtn } from "./ShutdownShared";

interface ShutdownJournalPromptProps {
  tomorrowTasks: Task[];
  onJournalNote: (emoji: string, note: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export function ShutdownJournalPrompt({
  tomorrowTasks,
  onJournalNote,
  onBack,
  onClose,
}: ShutdownJournalPromptProps): JSX.Element {
  const [emoji, setEmoji] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const handleSubmit = (): void => {
    if (emoji) {
      onJournalNote(emoji, note);
    }
    onClose();
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0, marginBottom: "1rem" }}>
        Next lineup
      </p>
      {tomorrowTasks.length === 0 ? (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "10px",
            background: "var(--surface-2)",
            marginBottom: "1.5rem",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
          }}
        >
          No scheduled tasks for tomorrow yet.
        </div>
      ) : (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "10px",
            background: "var(--surface-2)",
            marginBottom: "1.5rem",
            display: "grid",
            gap: "0.3rem",
          }}
        >
          {tomorrowTasks.slice(0, 5).map((task) => (
            <div key={task.id} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>→</span>
              <span>{task.title}</span>
            </div>
          ))}
          {tomorrowTasks.length > 5 && (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>+{tomorrowTasks.length - 5} more</div>
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
        <button onClick={onBack} style={secondaryBtn}>
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
