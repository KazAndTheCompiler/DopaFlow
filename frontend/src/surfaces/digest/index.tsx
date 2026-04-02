import { useEffect, useMemo, useState } from "react";
import Button from "@ds/primitives/Button";

interface DigestInsight {
  title: string;
  body: string;
}

interface DigestViewModel {
  summary: string;
  tasks_completed: number;
  focus_sessions: number;
  habits_logged: number;
  journal_entries: number;
  calories_kcal: number;
  avg_kcal: number;
  nutrition_days: number;
  insights: DigestInsight[];
}

interface DigestResponse {
  tasks?: { completed?: number };
  habits?: { by_habit?: Array<{ count?: number }>; best_habit?: string };
  focus?: { total_sessions?: number; total_minutes?: number };
  journal?: { entries_written?: number };
  nutrition?: { total_kcal?: number; avg_kcal?: number; days_logged?: number; protein_g?: number };
  momentum_label?: string;
  score?: number;
  date?: string;
  week_start?: string;
  week_end?: string;
}

function toViewModel(period: "today" | "week", raw: DigestResponse | null): DigestViewModel | null {
  if (!raw) return null;

  const tasks = raw.tasks ?? {};
  const habits = raw.habits ?? {};
  const focus = raw.focus ?? {};
  const journal = raw.journal ?? {};
  const nutrition = raw.nutrition ?? {};
  const nutritionDays = Number(nutrition.days_logged ?? 0);
  const label = raw.momentum_label ?? "steady";
  const score = raw.score ?? 0;
  const dateLabel = period === "today" ? raw.date : `${raw.week_start ?? ""} to ${raw.week_end ?? ""}`.trim();

  return {
    summary: `Digest for ${dateLabel || period}: score ${score}, momentum ${label}.`,
    tasks_completed: Number(tasks.completed ?? 0),
    focus_sessions: Number(focus.total_sessions ?? 0),
    habits_logged: Array.isArray(habits.by_habit)
      ? habits.by_habit.reduce((sum: number, item: { count?: number }) => sum + Number(item.count ?? 0), 0)
      : 0,
    journal_entries: Number(journal.entries_written ?? 0),
    calories_kcal: Number(nutrition.total_kcal ?? 0),
    avg_kcal: Number(nutrition.avg_kcal ?? 0),
    nutrition_days: nutritionDays,
    insights: [
      {
        title: "Momentum",
        body: `Momentum is ${label} with a score of ${score}.`,
      },
      {
        title: "Habits",
        body: habits.best_habit
          ? `Best habit this period: ${habits.best_habit}.`
          : "No standout habit yet this period.",
      },
      {
        title: "Focus",
        body: `${Number(focus.total_minutes ?? 0)} focused minutes across ${Number(focus.total_sessions ?? 0)} sessions.`,
      },
      ...(nutritionDays > 0
        ? [
            {
              title: "Nutrition",
              body: `${Number(nutrition.total_kcal ?? 0).toFixed(0)} kcal logged${period === "week" ? ` over ${nutritionDays} days (avg ${Number(nutrition.avg_kcal ?? 0).toFixed(0)} kcal/day)` : ""}.${nutrition.protein_g ? ` Protein: ${Number(nutrition.protein_g).toFixed(0)}g.` : ""}`,
            },
          ]
        : []),
    ],
  };
}


export default function DigestView(): JSX.Element {
  const [rawDigest, setRawDigest] = useState<DigestResponse | null>(null);
  const [period, setPeriod] = useState<"today" | "week">("today");

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v2"}/digest/${period}`)
      .then((r) => r.json())
      .then((body) => setRawDigest(body))
      .catch(() => setRawDigest(null));
  }, [period]);

  const digest = useMemo(() => toViewModel(period, rawDigest), [period, rawDigest]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={() => setPeriod("today")} variant={period === "today" ? "primary" : "secondary"} style={{ padding: "0.5rem 1rem" }}>Today</Button>
        <Button onClick={() => setPeriod("week")} variant={period === "week" ? "primary" : "secondary"} style={{ padding: "0.5rem 1rem" }}>Week</Button>
      </div>

      {digest && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section
            style={{
              padding: "1.25rem",
              borderRadius: "16px",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <strong>Summary</strong>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{digest.summary}</p>
          </section>

          {/* Activity distribution bar */}
          {(() => {
            const segments = [
              { label: "Tasks", value: digest.tasks_completed, color: "var(--accent)" },
              { label: "Focus", value: digest.focus_sessions, color: "#3b82f6" },
              { label: "Habits", value: digest.habits_logged, color: "#8b5cf6" },
              { label: "Journal", value: digest.journal_entries, color: "#f59e0b" },
            ].filter((s) => s.value > 0);
            const total = segments.reduce((sum, s) => sum + s.value, 0);
            if (total === 0) return null;
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
                <strong style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Activity
                </strong>
                <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2 }}>
                  {segments.map((s) => (
                    <div
                      key={s.label}
                      title={`${s.label}: ${s.value}`}
                      style={{ flex: s.value / total, background: s.color, minWidth: 4, transition: "flex 0.5s ease" }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {segments.map((s) => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "var(--text-xs)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                      <span style={{ fontWeight: 600 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Stat bars */}
          {(() => {
            const rows = [
              { label: "Tasks completed", value: digest.tasks_completed, max: period === "today" ? 20 : 100, color: "var(--accent)" },
              { label: "Focus sessions", value: digest.focus_sessions, max: period === "today" ? 6 : 30, color: "#3b82f6" },
              { label: "Habits logged", value: digest.habits_logged, max: period === "today" ? 10 : 70, color: "#8b5cf6" },
              { label: "Journal entries", value: digest.journal_entries, max: period === "today" ? 3 : 14, color: "#f59e0b" },
              ...(digest.nutrition_days > 0
                ? [{ label: period === "today" ? "Calories today" : "Avg kcal/day", value: period === "today" ? digest.calories_kcal : digest.avg_kcal, max: 2500, color: "#10b981" }]
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
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{row.label}</span>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>
                          {typeof row.value === "number" && row.value > 100 ? row.value.toFixed(0) : row.value}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: row.color, borderRadius: 999, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {digest.insights.length > 0 && (
            <section style={{ display: "grid", gap: "0.75rem" }}>
              <strong>Insights</strong>
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
                  <strong style={{ display: "block", marginBottom: "0.25rem" }}>{insight.title}</strong>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{insight.body}</span>
                </article>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
