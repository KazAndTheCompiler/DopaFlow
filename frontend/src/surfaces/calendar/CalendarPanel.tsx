import { useState } from "react";

import type { CalendarEvent } from "../../../../shared/types";
import VoiceCommandModal from "../../components/VoiceCommandModal";

interface CalendarPanelProps {
  onCreate: (event: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  onVoiceExecuted?: () => void;
}

export function CalendarPanel({ onCreate, onVoiceExecuted }: CalendarPanelProps): JSX.Element {
  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>("09:00");
  const [duration, setDuration] = useState<number>(60);

  const handleAdd = async (): Promise<void> => {
    if (!title.trim()) return;
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60_000);
    await onCreate({
      title: title.trim(),
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      all_day: false,
    });
    setTitle("");
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
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
          }}
        >
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <option key={m} value={m}>{m}m</option>
          ))}
        </select>
      </div>
      <button
        onClick={() => void handleAdd()}
        disabled={!title.trim()}
        style={{
          padding: "0.7rem 1.15rem",
          borderRadius: "12px",
          border: "none",
          background: title.trim() ? "linear-gradient(160deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))" : "var(--border-subtle)",
          color: "var(--text-inverted)",
          cursor: title.trim() ? "pointer" : "not-allowed",
          fontWeight: 700,
          alignSelf: "flex-end",
          boxShadow: title.trim() ? "var(--shadow-soft)" : "none",
        }}
      >
        Add block
      </button>
      <VoiceCommandModal
        initialCommandWord="calendar"
        {...(onVoiceExecuted ? { onExecuted: onVoiceExecuted } : {})}
      />
    </section>
  );
}

export default CalendarPanel;
