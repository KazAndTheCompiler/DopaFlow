import { useContext, useEffect, useState } from "react";

import { AppDataContext } from "../../App";
import { getHabitLogs } from "@api/habits";
import CorrelationChart from "./CorrelationChart";
import HabitsPanel from "./HabitsPanel";
import StreakHeatmap from "./StreakHeatmap";

export default function HabitsView(): JSX.Element {
  const app = useContext(AppDataContext);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState(1);
  const [period, setPeriod] = useState("day");
  const [busy, setBusy] = useState(false);
  const [checkins, setCheckins] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!app || app.habits.habits.length === 0) return;
    void Promise.all(
      app.habits.habits.map((h) =>
        getHabitLogs(h.id).then((logs) => ({ id: h.id, dates: logs.map((l) => l.checkin_date) }))
      )
    ).then((results) => {
      const map: Record<string, string[]> = {};
      for (const r of results) map[r.id] = r.dates;
      setCheckins(map);
    });
  }, [app?.habits.habits]);

  if (!app) return <div>App context unavailable.</div>;

  const handleAdd = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await app.habits.create({ name: trimmed, target_freq: freq, target_period: period });
      await app.habits.refresh();
      setName("");
      setFreq(1);
      setPeriod("day");
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
          padding: "1rem 1.25rem",
          background: "var(--surface)",
          borderRadius: "18px",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          gap: "0.65rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: "1 1 180px", display: "grid", gap: "0.25rem" }}>
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
            padding: "0.45rem 1.1rem",
            borderRadius: "8px",
            border: "none",
            background: name.trim() ? "var(--accent)" : "var(--border-subtle)",
            color: "var(--text-inverted)",
            cursor: name.trim() ? "pointer" : "not-allowed",
            fontWeight: 600,
            alignSelf: "flex-end",
          }}
        >
          {busy ? "…" : "+ Add habit"}
        </button>
      </section>

      <HabitsPanel habits={app.habits.habits} loading={app.habits.loading} onCheckIn={(id) => void app.habits.checkIn(id)} onRefresh={() => void app.habits.refresh()} />
      {app.habits.habits.length > 0 && <StreakHeatmap habits={app.habits.habits} checkins={checkins} />}
      <CorrelationChart insights={app.insights.correlations} />
    </div>
  );
}
