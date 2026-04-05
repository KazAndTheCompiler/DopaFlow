import { useState } from "react";

import type { CalendarEvent } from "../../../../shared/types";
import { showToast } from "@ds/primitives/Toast";
import VoiceCommandModal from "../../components/VoiceCommandModal";

interface CalendarPanelProps {
  onCreate: (event: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  onVoiceExecuted?: () => void;
}

export function CalendarPanel({ onCreate, onVoiceExecuted }: CalendarPanelProps): JSX.Element {
  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>("09:00");
  const [durationHours, setDurationHours] = useState<number>(1);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const durationTotalMinutes = Math.max(1, durationHours * 60 + durationMinutes);

  const handleAdd = async (): Promise<void> => {
    if (!title.trim() || submitting) return;
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + durationTotalMinutes * 60_000);
    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: false,
      });
      setTitle("");
      showToast("Calendar block added.", "success");
    } catch {
      showToast("Could not add the calendar block.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      style={{
        padding: "1.1rem 1.2rem 1.2rem",
        background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 84%, white 16%), var(--surface))",
        borderRadius: "22px",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        gap: "0.75rem",
        flexWrap: "wrap",
        alignItems: "flex-end",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "grid", gap: "0.2rem", flex: "1 1 100%" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Quick add calendar block</strong>
        <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          Drop a task, meeting, or focus block into the schedule without opening a separate editor.
        </span>
      </div>
      <div style={{ flex: "1 1 180px", display: "grid", gap: "0.25rem" }}>
        <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Title</label>
        <input
          value={title}
        onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
          placeholder="Event name"
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            fontSize: "var(--text-base)",
            boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--surface) 82%, white 18%)",
          }}
        />
      </div>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
          }}
        />
      </div>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
          }}
        />
      </div>
      <div style={{ display: "grid", gap: "0.25rem" }}>
        <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Duration</label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(88px, 1fr))",
            gap: "0.45rem",
          }}
        >
          <input
            type="number"
            min={0}
            value={durationHours}
            onChange={(e) => setDurationHours(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Duration hours"
            placeholder="Hours"
            style={{
              padding: "0.6rem 0.8rem",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          />
          <input
            type="number"
            min={0}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Math.max(0, Number(e.target.value) || 0))}
            aria-label="Duration minutes"
            placeholder="Minutes"
            style={{
              padding: "0.6rem 0.8rem",
              borderRadius: "12px",
              border: "1px solid var(--border-subtle)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
          {durationTotalMinutes} minute{durationTotalMinutes === 1 ? "" : "s"}
        </span>
      </div>
      <button
        onClick={() => void handleAdd()}
        disabled={!title.trim() || submitting}
        style={{
          padding: "0.7rem 1.15rem",
          borderRadius: "12px",
          border: "none",
          background: title.trim() && !submitting ? "linear-gradient(160deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))" : "var(--border-subtle)",
          color: "var(--text-inverted)",
          cursor: title.trim() && !submitting ? "pointer" : "not-allowed",
          fontWeight: 700,
          alignSelf: "flex-end",
          boxShadow: title.trim() && !submitting ? "var(--shadow-soft)" : "none",
        }}
      >
        {submitting ? "Adding…" : "Add block"}
      </button>
      <VoiceCommandModal
        initialCommandWord="calendar"
        {...(onVoiceExecuted ? { onExecuted: onVoiceExecuted } : {})}
      />
    </section>
  );
}

export default CalendarPanel;
