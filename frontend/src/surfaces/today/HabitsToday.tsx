import type { Habit } from "../../../../shared/types";

export interface HabitsTodayProps {
  habits: Habit[];
  onCheckIn: (habitId: string) => Promise<void>;
}

function isCheckedInToday(habit: Habit): boolean {
  if (!habit.last_checkin_date) {
 return false;
}
  const checkinDate = new Date(habit.last_checkin_date);
  const today = new Date();
  return (
    checkinDate.getFullYear() === today.getFullYear() &&
    checkinDate.getMonth() === today.getMonth() &&
    checkinDate.getDate() === today.getDate()
  );
}

export function HabitsToday({ habits, onCheckIn }: HabitsTodayProps): JSX.Element {
  const checkedIn = habits.filter(isCheckedInToday).length;

  return (
    <section
      style={{
        display: "grid",
        gap: "0.85rem",
        padding: "1.1rem 1.15rem",
        borderRadius: "20px",
        background: "var(--card-gradient, color-mix(in srgb, var(--surface) 92%, transparent))",
        backdropFilter: "var(--surface-glass-blur, blur(14px))",
        border: "1px solid var(--border-subtle)",
        position: "relative",
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "1px", background: "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-inner-light)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35%", background: "var(--surface-inner-highlight)", pointerEvents: "none", borderRadius: "inherit" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--surface-specular)", pointerEvents: "none", borderRadius: "inherit" }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Habits Today</strong>
        {habits.length > 0 && (
          <span
            style={{
              padding: "0.15rem 0.55rem",
              borderRadius: "999px",
              background: checkedIn === habits.length
                ? "color-mix(in srgb, var(--state-completed) 14%, transparent)"
                : "var(--surface-2)",
              border: checkedIn === habits.length
                ? "1px solid color-mix(in srgb, var(--state-completed) 30%, transparent)"
                : "1px solid transparent",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: checkedIn === habits.length ? "var(--state-completed)" : "var(--text-secondary)",
            }}
          >
            {checkedIn}/{habits.length}
          </span>
        )}
      </div>

      {habits.length === 0 ? (
        <div
          style={{
            padding: "1.25rem 1rem",
            borderRadius: "14px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border-subtle)",
            textAlign: "center",
            display: "grid",
            gap: "0.3rem",
          }}
        >
          <strong style={{ fontSize: "var(--text-sm)" }}>No habits yet</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            Add habits to start building consistent streaks.
          </span>
        </div>
      ) : (
        habits.map((habit) => {
          const doneToday = isCheckedInToday(habit);
          return (
            <button
              key={habit.id}
              onClick={() => void onCheckIn(habit.id)}
              aria-label={`${habit.name} — ${doneToday ? "checked in today" : "tap to check in"}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "12px",
                border: doneToday
                  ? "1px solid color-mix(in srgb, var(--state-completed) 25%, transparent)"
                  : "1px solid transparent",
                background: doneToday
                  ? "color-mix(in srgb, var(--state-completed) 6%, transparent)"
                  : "var(--surface-2)",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "999px",
                  border: `2px solid ${doneToday ? "var(--state-completed)" : "var(--accent)"}`,
                  background: doneToday ? "var(--state-completed)" : "transparent",
                  display: "grid",
                  placeItems: "center",
                  transition: "background 150ms, border-color 150ms",
                  flexShrink: 0,
                }}
              >
                {doneToday && (
                  <span style={{ fontSize: "0.6rem", color: "white", fontWeight: 800, lineHeight: 1 }}>✓</span>
                )}
              </span>
              <span style={{ flex: 1, fontSize: "var(--text-sm)", opacity: doneToday ? 0.65 : 1 }}>
                {habit.name}
              </span>
              {habit.current_streak > 0 && (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: doneToday ? "var(--state-completed)" : "var(--text-muted)",
                  }}
                >
                  {habit.current_streak}d
                </span>
              )}
            </button>
          );
        })
      )}
    </section>
  );
}

export default HabitsToday;
