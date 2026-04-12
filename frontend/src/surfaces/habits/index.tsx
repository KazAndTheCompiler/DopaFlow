import { useEffect, useState } from "react";

import { useAppHabits, useAppInsights } from "../../app/AppContexts";
import { showToast } from "@ds/primitives/Toast";
import CorrelationChart from "./CorrelationChart";
import HabitsPanel from "./HabitsPanel";
import StreakHeatmap from "./StreakHeatmap";

export default function HabitsView(): JSX.Element {
  const habits = useAppHabits();
  const insights = useAppInsights();
  const [name, setName] = useState("");
  const [freq, setFreq] = useState(1);
  const [period, setPeriod] = useState("day");
  const [busy, setBusy] = useState(false);
  const [checkins, setCheckins] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (habits.habits.length === 0) return;
    void Promise.all(
      habits.habits.map((h) =>
        habits.getLogs(h.id).then((logs) => ({ id: h.id, dates: logs.map((l) => l.checkin_date) }))
      )
    ).then((results) => {
      const map: Record<string, string[]> = {};
      for (const r of results) map[r.id] = r.dates;
      setCheckins(map);
    });
  }, [habits.habits, habits.getLogs]);

  const totalHabits = habits.habits.length;
  const checkedInHabits = habits.habits.filter((habit) => (habit.completion_pct ?? 0) >= 100).length;
  const bestStreak = habits.habits.reduce((best, habit) => Math.max(best, habit.current_streak), 0);
  const nextNudge = totalHabits > 0
    ? checkedInHabits === totalHabits
      ? "Everything due is already handled. Freeze or review tomorrow before you add more."
      : "Check off the habit you are most likely to skip first. Momentum matters more than volume."
    : "Start with one habit that can survive a bad day. The surface gets stronger once the first loop exists.";

  const handleAdd = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await habits.create({ name: trimmed, target_freq: freq, target_period: period });
      setName("");
      setFreq(1);
      setPeriod("day");
    } catch (error) {
      showToast("Could not create the habit. Check the server is running.", "error");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    padding: "0.4rem 0.65rem",
    borderRadius: "8px",
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    fontSize: "var(--text-base)",
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section
        style={{
          padding: "1rem 1.1rem",
          borderRadius: "20px",
          background: "linear-gradient(145deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), var(--surface))",
          border: "1px solid color-mix(in srgb, var(--accent) 16%, var(--border-subtle))",
          display: "grid",
          gap: "0.9rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "0.3rem", maxWidth: "60ch" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Habit runway
            </span>
            <strong style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>
              Keep the habit list small enough to trust
            </strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {nextNudge}
            </span>
          </div>
          <div style={{ display: "grid", gap: "0.5rem", minWidth: "220px", flex: "1 1 260px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.55rem" }}>
              <div style={{ padding: "0.8rem 0.85rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Live
                </span>
                <strong style={{ fontSize: "1.25rem" }}>{totalHabits}</strong>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>habits tracked</span>
              </div>
              <div style={{ padding: "0.8rem 0.85rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Done
                </span>
                <strong style={{ fontSize: "1.25rem" }}>{checkedInHabits}</strong>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>fully checked in</span>
              </div>
              <div style={{ padding: "0.8rem 0.85rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.15rem" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Best
                </span>
                <strong style={{ fontSize: "1.25rem" }}>{bestStreak}d</strong>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>current top streak</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "1rem 1.25rem",
          background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 93%, white 7%), color-mix(in srgb, var(--surface) 98%, black 2%))",
          borderRadius: "20px",
          border: "1px solid var(--border-subtle)",
          display: "grid",
          gap: "0.9rem",
        }}
      >
        <div style={{ display: "grid", gap: "0.25rem", maxWidth: "64ch" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
            Add a loop
          </span>
          <strong style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>
            Capture the next repeatable behavior
          </strong>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Aim for something obvious enough to survive low-energy days. One durable habit beats five abandoned ones.
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", display: "grid", gap: "0.25rem" }}>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Habit name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              placeholder="e.g. Morning workout"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Times per</label>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <input
                type="number"
                min={1}
                max={99}
                value={freq}
                onChange={(e) => setFreq(Math.max(1, Number(e.target.value)))}
                style={{ ...inputStyle, width: "3.5rem" }}
              />
              <select value={period} onChange={(e) => setPeriod(e.target.value)} style={inputStyle}>
                <option value="day">Day</option>
                <option value="week">Week</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => void handleAdd()}
            disabled={!name.trim() || busy}
            style={{
              padding: "0.6rem 1.1rem",
              borderRadius: "10px",
              border: "none",
              background: name.trim() ? "var(--accent)" : "var(--border-subtle)",
              color: "var(--text-inverted)",
              cursor: name.trim() ? "pointer" : "not-allowed",
              fontWeight: 700,
              alignSelf: "flex-end",
            }}
          >
            {busy ? "…" : "+ Add habit"}
          </button>
        </div>
      </section>

      <HabitsPanel habits={habits.habits} loading={habits.loading} onCheckIn={(id) => void habits.checkIn(id)} onRefresh={() => void habits.refresh()} />
      {habits.habits.length > 0 && <StreakHeatmap habits={habits.habits} checkins={checkins} />}
      <CorrelationChart insights={insights.correlations} />
    </div>
  );
}
