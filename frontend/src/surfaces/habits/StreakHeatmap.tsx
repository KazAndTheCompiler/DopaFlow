import type { Habit } from "../../../../shared/types";

interface StreakHeatmapProps {
  habits: Habit[];
  checkins?: Record<string, string[]>;
}

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function StreakHeatmap({ habits, checkins = {} }: StreakHeatmapProps): JSX.Element {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 7 * 52 + 1);
  startDate.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 52 * 7 }, (_, i) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    const iso = day.toISOString().slice(0, 10);
    return { iso, col: Math.floor(i / 7), row: mondayIndex(day) };
  });

  return (
    <section
      style={{
        padding: "1rem",
        background: "var(--surface-2)",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.7rem",
      }}
    >
      {habits.map((habit) => {
        const done = new Set(checkins[habit.id] ?? []);
        return (
          <div key={habit.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.75rem", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {habit.name}
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(52, 10px)",
                gridTemplateRows: "repeat(7, 10px)",
                gap: "2px",
              }}
            >
              {days.map((day) => (
                <div
                  key={`${habit.id}-${day.iso}`}
                  title={day.iso}
                  style={{
                    gridColumn: day.col + 1,
                    gridRow: day.row + 1,
                    width: "10px",
                    height: "10px",
                    borderRadius: "2px",
                    background: done.has(day.iso) ? "var(--accent)" : "var(--border-subtle)",
                    opacity: done.has(day.iso) ? 0.8 : 0.5,
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default StreakHeatmap;
