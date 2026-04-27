import { useEffect, useMemo, useState } from "react";

import {
  getDailyDigest,
  getWeeklyDigestReport,
  type DailyDigest,
  type WeeklyDigestReport,
} from "@api/digest";
import Button from "@ds/primitives/Button";

interface DigestInsight {
  title: string;
  body: string;
}

interface DigestViewModel {
  headline: string;
  summary: string;
  momentum_label: string;
  score: number;
  date_label: string;
  tasks_completed: number;
  focus_sessions: number;
  focus_minutes: number;
  habits_logged: number;
  journal_entries: number;
  calories_kcal: number;
  avg_kcal: number;
  nutrition_days: number;
  insights: DigestInsight[];
}

type DigestResponse = DailyDigest | WeeklyDigestReport;

function toViewModel(
  period: "today" | "week",
  raw: DigestResponse | null,
): DigestViewModel | null {
  if (!raw) {
    return null;
  }

  const tasks = raw.tasks;
  const habits = raw.habits;
  const focus = raw.focus;
  const journal = raw.journal;
  const nutrition = raw.nutrition;
  const nutritionDays = nutrition?.days_logged ?? 0;
  const label = raw.momentum_label;
  const score = raw.score;
  const dateLabel =
    period === "today"
      ? "date" in raw
        ? raw.date
        : ""
      : "week_start" in raw
        ? `${raw.week_start} to ${raw.week_end}`
        : "";
  const tasksCompleted = tasks?.completed ?? 0;
  const focusSessions = focus?.total_sessions ?? 0;
  const focusMinutes = focus?.total_minutes ?? 0;
  const habitLogs =
    habits?.by_habit?.reduce((sum, item) => sum + (item.done ?? 0), 0) ?? 0;
  const journalEntries = journal?.entries_written ?? 0;

  let headline = "A quieter day than usual.";
  if (score >= 80) {
    headline =
      period === "today"
        ? "You had a strong day across the core loops."
        : "This was a strong week with real follow-through.";
  } else if (score >= 60) {
    headline =
      period === "today"
        ? "You kept momentum moving in the right direction."
        : "The week stayed on track without falling apart.";
  } else if (tasksCompleted + focusSessions + habitLogs + journalEntries > 0) {
    headline =
      period === "today"
        ? "Some progress landed, but the day stayed uneven."
        : "There was activity this week, but the system did not lock in.";
  }

  return {
    headline,
    summary:
      score >= 70
        ? `Momentum is ${label}. Keep protecting the routines that produced it.`
        : `Momentum is ${label}. The next gain comes from tightening consistency rather than adding more input.`,
    momentum_label: label,
    score,
    date_label: dateLabel || period,
    tasks_completed: tasksCompleted,
    focus_sessions: focusSessions,
    focus_minutes: focusMinutes,
    habits_logged: habitLogs,
    journal_entries: journalEntries,
    calories_kcal: Number(nutrition?.total_kcal ?? 0),
    avg_kcal: Number(nutrition?.avg_kcal ?? 0),
    nutrition_days: nutritionDays,
    insights: [
      {
        title: "Momentum",
        body:
          score >= 70
            ? `Score ${score} with ${label} momentum. The system is holding together.`
            : `Score ${score} with ${label} momentum. The system needs a cleaner next step, not more complexity.`,
      },
      {
        title: "Habits",
        body: habits?.best_habit
          ? `Best habit this period: ${habits.best_habit}.`
          : "No standout habit yet this period.",
      },
      {
        title: "Focus",
        body: `${focusMinutes} focused minutes across ${focusSessions} session${focusSessions === 1 ? "" : "s"}.`,
      },
      ...(nutritionDays > 0
        ? [
            {
              title: "Nutrition",
              body: `${(nutrition?.total_kcal ?? 0).toFixed(0)} kcal logged${period === "week" ? ` over ${nutritionDays} days (avg ${(nutrition?.avg_kcal ?? 0).toFixed(0)} kcal/day)` : ""}.${nutrition?.protein_g ? ` Protein: ${nutrition.protein_g.toFixed(0)}g.` : ""}`,
            },
          ]
        : []),
    ],
  };
}

export default function DigestView(): JSX.Element {
  const [rawDigest, setRawDigest] = useState<DigestResponse | null>(null);
  const [period, setPeriod] = useState<"today" | "week">("today");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const request =
      period === "today" ? getDailyDigest() : getWeeklyDigestReport();
    void request
      .then((body) => {
        setRawDigest(body);
        setLoading(false);
      })
      .catch(() => {
        setRawDigest(null);
        setError("Could not load digest. Check the server is running.");
        setLoading(false);
      });
  }, [period]);

  const digest = useMemo(
    () => toViewModel(period, rawDigest),
    [period, rawDigest],
  );
  const activityTotal = digest
    ? digest.tasks_completed +
      digest.focus_sessions +
      digest.habits_logged +
      digest.journal_entries
    : 0;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button
          onClick={() => setPeriod("today")}
          variant={period === "today" ? "primary" : "secondary"}
          style={{ padding: "0.5rem 1rem" }}
        >
          Today
        </Button>
        <Button
          onClick={() => setPeriod("week")}
          variant={period === "week" ? "primary" : "secondary"}
          style={{ padding: "0.5rem 1rem" }}
        >
          Week
        </Button>
      </div>

      {loading && (
        <section
          style={{
            padding: "1.25rem",
            borderRadius: "16px",
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          Loading digest…
        </section>
      )}

      {!loading && error && (
        <section
          style={{
            padding: "1.25rem",
            borderRadius: "16px",
            background: "var(--surface)",
            border:
              "1px solid color-mix(in srgb, var(--state-overdue) 35%, var(--border-subtle))",
            color: "var(--text-secondary)",
            display: "grid",
            gap: "0.35rem",
          }}
        >
          <strong>Digest unavailable</strong>
          <span>{error}</span>
        </section>
      )}

      {!loading && !error && digest && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section
            style={{
              padding: "1.25rem",
              borderRadius: "20px",
              background:
                "linear-gradient(145deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), var(--surface))",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: "1.1rem" }}>{digest.headline}</strong>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {period === "today"
                  ? digest.date_label
                  : `Week ${digest.date_label}`}
              </span>
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {digest.summary}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "14px",
                  background:
                    "color-mix(in srgb, var(--surface) 88%, white 12%)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Score
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>
                  {digest.score}
                </div>
              </div>
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "14px",
                  background:
                    "color-mix(in srgb, var(--surface) 88%, white 12%)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Momentum
                </div>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    textTransform: "capitalize",
                  }}
                >
                  {digest.momentum_label}
                </div>
              </div>
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "14px",
                  background:
                    "color-mix(in srgb, var(--surface) 88%, white 12%)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Focus time
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                  {digest.focus_minutes}m
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              padding: "1.25rem",
              borderRadius: "16px",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gap: "0.6rem",
            }}
          >
            <strong>What this period says</strong>
            {activityTotal === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                There is not enough activity here yet to draw a real conclusion.
                Use this view after a day or week with actual task, focus, or
                habit activity.
              </p>
            ) : (
              <p
                style={{
                  margin: 0,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {digest.tasks_completed > 0
                  ? `Execution is visible with ${digest.tasks_completed} completed task${digest.tasks_completed === 1 ? "" : "s"}. `
                  : "Task completion did not carry this period. "}
                {digest.focus_minutes >= (period === "today" ? 45 : 180)
                  ? "Focus time was strong enough to support meaningful work. "
                  : "Focus time was present, but not yet strong enough to anchor the whole system. "}
                {digest.habits_logged > 0
                  ? "Habit logging stayed alive, which helps keep momentum from collapsing."
                  : "Habit logging was quiet, so momentum relied on fewer anchors than it should."}
              </p>
            )}
          </section>

          {(() => {
            const segments = [
              {
                label: "Tasks",
                value: digest.tasks_completed,
                color: "var(--accent)",
              },
              {
                label: "Focus",
                value: digest.focus_sessions,
                color: "#3b82f6",
              },
              {
                label: "Habits",
                value: digest.habits_logged,
                color: "#8b5cf6",
              },
              {
                label: "Journal",
                value: digest.journal_entries,
                color: "#f59e0b",
              },
            ].filter((segment) => segment.value > 0);
            const total = segments.reduce(
              (sum, segment) => sum + segment.value,
              0,
            );
            if (total === 0) {
              return null;
            }
            return (
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: "16px",
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "grid",
                  gap: "0.75rem",
                }}
              >
                <strong
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Activity
                </strong>
                <div
                  style={{
                    display: "flex",
                    height: 12,
                    borderRadius: 999,
                    overflow: "hidden",
                    gap: 2,
                  }}
                >
                  {segments.map((segment) => (
                    <div
                      key={segment.label}
                      title={`${segment.label}: ${segment.value}`}
                      style={{
                        flex: segment.value / total,
                        background: segment.color,
                        minWidth: 4,
                        transition: "flex 0.5s ease",
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {segments.map((segment) => (
                    <div
                      key={segment.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "var(--text-xs)",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: segment.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: "var(--text-secondary)" }}>
                        {segment.label}
                      </span>
                      <span style={{ fontWeight: 600 }}>{segment.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {(() => {
            const rows = [
              {
                label: "Tasks completed",
                value: digest.tasks_completed,
                max: period === "today" ? 20 : 100,
                color: "var(--accent)",
              },
              {
                label: "Focus sessions",
                value: digest.focus_sessions,
                max: period === "today" ? 6 : 30,
                color: "#3b82f6",
              },
              {
                label: "Habits logged",
                value: digest.habits_logged,
                max: period === "today" ? 10 : 70,
                color: "#8b5cf6",
              },
              {
                label: "Journal entries",
                value: digest.journal_entries,
                max: period === "today" ? 3 : 14,
                color: "#f59e0b",
              },
              ...(digest.nutrition_days > 0
                ? [
                    {
                      label:
                        period === "today" ? "Calories today" : "Avg kcal/day",
                      value:
                        period === "today"
                          ? digest.calories_kcal
                          : digest.avg_kcal,
                      max: 2500,
                      color: "#10b981",
                    },
                  ]
                : []),
            ];
            return (
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: "16px",
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "grid",
                  gap: "0.8rem",
                }}
              >
                {rows.map((row) => {
                  const pct = Math.min(100, (row.value / row.max) * 100);
                  return (
                    <div key={row.label}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--text-sm)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {row.label}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--text-sm)",
                            fontWeight: 700,
                          }}
                        >
                          {typeof row.value === "number" && row.value > 100
                            ? row.value.toFixed(0)
                            : row.value}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          background: "var(--surface-2)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: row.color,
                            borderRadius: 999,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {digest.insights.length > 0 && (
            <section style={{ display: "grid", gap: "0.75rem" }}>
              <strong>What to reinforce</strong>
              {digest.insights.map((insight) => (
                <article
                  key={insight.title}
                  style={{
                    padding: "1rem",
                    borderRadius: "12px",
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    borderLeft: "4px solid var(--accent)",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "0.25rem" }}>
                    {insight.title}
                  </strong>
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {insight.body}
                  </span>
                </article>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
