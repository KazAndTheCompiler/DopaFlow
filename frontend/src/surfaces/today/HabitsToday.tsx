import type { Habit } from "../../../../shared/types";

export interface HabitsTodayProps {
  habits: Habit[];
  onCheckIn: (habitId: string) => Promise<void>;
}

function getTodayCount(habit: Habit): number {
  return habit.today_count ?? 0;
}

function isTargetMet(habit: Habit): boolean {
  return getTodayCount(habit) >= habit.target_freq;
}

export function HabitsToday({
  habits,
  onCheckIn,
}: HabitsTodayProps): JSX.Element {
  const totalCompleted = habits.filter(isTargetMet).length;

  return (
    <section
      style={{
        display: "grid",
        gap: "0.85rem",
        padding: "1.1rem 1.15rem",
        borderRadius: "20px",
        background:
          "var(--card-gradient, color-mix(in srgb, var(--surface) 92%, transparent))",
        backdropFilter: "var(--surface-glass-blur, blur(14px))",
        border: "1px solid var(--border-subtle)",
        position: "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: "8%",
          right: "8%",
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)",
          pointerEvents: "none",
          borderRadius: "1px",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--surface-inner-light)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "35%",
          background: "var(--surface-inner-highlight)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--surface-specular)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Habits Today</strong>
        {habits.length > 0 && (
          <span
            style={{
              padding: "0.15rem 0.55rem",
              borderRadius: "999px",
              background:
                totalCompleted === habits.length
                  ? "color-mix(in srgb, var(--state-completed) 14%, transparent)"
                  : "var(--surface-2)",
              border:
                totalCompleted === habits.length
                  ? "1px solid color-mix(in srgb, var(--state-completed) 30%, transparent)"
                  : "1px solid transparent",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color:
                totalCompleted === habits.length
                  ? "var(--state-completed)"
                  : "var(--text-secondary)",
            }}
          >
            {totalCompleted}/{habits.length}
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
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
            }}
          >
            Add habits to start building consistent streaks.
          </span>
        </div>
      ) : (
        habits.map((habit) => {
          const count = getTodayCount(habit);
          const target = habit.target_freq;
          const done = isTargetMet(habit);
          const multiTarget = target > 1;
          const pct = Math.min(count / target, 1);

          return (
            <div
              key={habit.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "12px",
                border: done
                  ? "1px solid color-mix(in srgb, var(--state-completed) 25%, transparent)"
                  : "1px solid transparent",
                background: done
                  ? "color-mix(in srgb, var(--state-completed) 6%, transparent)"
                  : "var(--surface-2)",
                color: "inherit",
                textAlign: "left",
                transition: "background 150ms ease, border-color 150ms ease",
              }}
            >
              {/* Progress ring or check circle */}
              <span
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "999px",
                  border: `2px solid ${done ? "var(--state-completed)" : "var(--accent)"}`,
                  background: done ? "var(--state-completed)" : "transparent",
                  display: "grid",
                  placeItems: "center",
                  transition: "background 150ms, border-color 150ms",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {done ? (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      color: "white",
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                ) : multiTarget ? (
                  <span
                    style={{
                      fontSize: "0.55rem",
                      color: "var(--accent)",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {count}
                  </span>
                ) : null}
              </span>

              <span
                style={{
                  flex: 1,
                  fontSize: "var(--text-sm)",
                  opacity: done ? 0.65 : 1,
                }}
              >
                {habit.name}
                {multiTarget && (
                  <span
                    style={{
                      marginLeft: "0.4rem",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {count}/{target}
                  </span>
                )}
              </span>

              {/* Progress bar for multi-target */}
              {multiTarget && !done && (
                <span
                  style={{
                    width: "40px",
                    height: "4px",
                    borderRadius: "2px",
                    background: "var(--border-subtle)",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${pct * 100}%`,
                      height: "100%",
                      borderRadius: "2px",
                      background: "var(--accent)",
                      transition: "width 200ms ease",
                    }}
                  />
                </span>
              )}

              {habit.current_streak > 0 && (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: done
                      ? "var(--state-completed)"
                      : "var(--text-muted)",
                  }}
                >
                  {habit.current_streak}d
                </span>
              )}

              {/* +1 checkin button */}
              {!done && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void onCheckIn(habit.id);
                  }}
                  aria-label={`Check in ${habit.name}`}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "8px",
                    border: "1px solid var(--accent)",
                    background: "transparent",
                    color: "var(--accent)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    flexShrink: 0,
                    transition: "background 100ms ease",
                  }}
                >
                  +
                </button>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

export default HabitsToday;
