import { useContext, useEffect, useMemo, useState } from "react";

import { AppDataContext } from "../../App";
import DigestCard from "../../components/DigestCard";
import { OverviewSurfaceSkeleton } from "@ds/primitives/Skeleton";

const FOCUS_PREFILL_KEY = "zoestm_focus_prefill";
const TODAY_KEY = "zoestm_planned_date";

const LEVEL_COLOR: Record<string, string> = {
  low: "var(--text-secondary)",
  building: "var(--state-warn)",
  flowing: "#3b82f6",
  peak: "var(--state-ok)",
};

interface OverviewDigestData {
  score: number;
  momentum_score: number;
  momentum_label: string;
  tasks: { completed: number; completion_rate: number };
  habits: { overall_rate: number };
  focus: { total_minutes: number };
}

function normalizeDigestData(value: unknown): OverviewDigestData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const digest = value as Record<string, unknown>;
  const tasks = digest.tasks;
  const habits = digest.habits;
  const focus = digest.focus;

  if (!tasks || typeof tasks !== "object" || !habits || typeof habits !== "object" || !focus || typeof focus !== "object") {
    return null;
  }

  return {
    score: typeof digest.score === "number" ? digest.score : 0,
    momentum_score: typeof digest.momentum_score === "number" ? digest.momentum_score : 0,
    momentum_label: typeof digest.momentum_label === "string" ? digest.momentum_label : "Unknown",
    tasks: {
      completed: typeof (tasks as Record<string, unknown>).completed === "number" ? (tasks as Record<string, unknown>).completed as number : 0,
      completion_rate: typeof (tasks as Record<string, unknown>).completion_rate === "number" ? (tasks as Record<string, unknown>).completion_rate as number : 0,
    },
    habits: {
      overall_rate: typeof (habits as Record<string, unknown>).overall_rate === "number" ? (habits as Record<string, unknown>).overall_rate as number : 0,
    },
    focus: {
      total_minutes: typeof (focus as Record<string, unknown>).total_minutes === "number" ? (focus as Record<string, unknown>).total_minutes as number : 0,
    },
  };
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }): JSX.Element {
  return (
    <div
      style={{
        padding: "1.25rem",
        borderRadius: "16px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.25rem",
      }}
    >
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ fontSize: "2rem", fontWeight: 700, color: accent ?? "var(--accent)", lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{sub}</span>}
    </div>
  );
}

export default function OverviewView(): JSX.Element {
  const app = useContext(AppDataContext);
  const [digestData, setDigestData] = useState<OverviewDigestData | null>(null);

  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v2"}/digest/today`)
      .then((r) => r.json())
      .then((body) => setDigestData(normalizeDigestData(body)))
      .catch(() => setDigestData(null));
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const plannedToday = localStorage.getItem(TODAY_KEY) === todayIso;

  const tasksDueToday = useMemo(
    () => (app?.tasks.tasks ?? []).filter((t) => !t.done && t.due_at && t.due_at.slice(0, 10) <= todayIso).length,
    [app?.tasks.tasks, todayIso],
  );

  const tasksCompletedToday = useMemo(
    () => (app?.tasks.tasks ?? []).filter((t) => t.done && t.updated_at?.slice(0, 10) === todayIso).length,
    [app?.tasks.tasks, todayIso],
  );

  const focusMinutesToday = useMemo(() => {
    const sessions = app?.focus.sessions ?? [];
    return sessions
      .filter((s) => s.started_at?.slice(0, 10) === todayIso && s.status === "completed")
      .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  }, [app?.focus.sessions, todayIso]);

  const habitsStreakAvg = useMemo(() => {
    const habits = app?.habits.habits ?? [];
    if (!habits.length) return 0;
    return Math.round(habits.reduce((sum, h) => sum + (h.current_streak ?? 0), 0) / habits.length);
  }, [app?.habits.habits]);

  const momentum = app?.packy.momentum ?? app?.insights.momentum;
  const momentumLevel = momentum?.level ?? "low";
  const momentumColor = LEVEL_COLOR[momentumLevel] ?? "var(--accent)";

  const correlations = (app?.insights.correlations ?? []).map((item) => ({
    habit: item.metric,
    correlation: item.pearson_r ?? 0,
  }));

  const topLinkedNodes = useMemo(
    () =>
      (app?.journal.graph.nodes ?? [])
        .map((node) => ({ id: node.id, label: node.date, links: node.entry_count }))
        .sort((a, b) => b.links - a.links)
        .slice(0, 5),
    [app?.journal.graph.nodes],
  );

  const weeklyDigest = app?.insights.weeklyDigest;
  const nextFocusTask = useMemo(
    () =>
      (app?.tasks.tasks ?? [])
        .filter((task) => !task.done && task.due_at?.slice(0, 10) === todayIso)
        .sort((left, right) => {
          if (left.priority !== right.priority) {
            return left.priority - right.priority;
          }
          return left.title.localeCompare(right.title);
        })[0] ?? null,
    [app?.tasks.tasks, todayIso],
  );
  const nextCalendarBlock = useMemo(
    () =>
      (app?.calendar.events ?? [])
        .filter((event) => event.start_at.slice(0, 10) === todayIso)
        .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime())[0] ?? null,
    [app?.calendar.events, todayIso],
  );

  const runway = (() => {
    if (app?.focus.activeSession) {
      return {
        eyebrow: "Live now",
        title: "Return to the active focus block",
        body: "Your work timer is already running. Protect that momentum before you reopen planning.",
        primaryLabel: "Open focus",
        primaryAction: () => {
          window.location.hash = "#/focus";
        },
        secondaryLabel: "Open today",
        secondaryAction: () => {
          window.location.hash = "#/today";
        },
      };
    }

    if (!plannedToday) {
      return {
        eyebrow: "Missing ritual",
        title: "Plan today before you drift into reaction mode",
        body: "The stats are useful, but the next leverage move is still to commit your top three and first work block.",
        primaryLabel: "Plan day",
        primaryAction: () => {
          window.location.hash = "#/plan";
        },
        secondaryLabel: "Open today",
        secondaryAction: () => {
          window.location.hash = "#/today";
        },
      };
    }

    if (nextFocusTask) {
      return {
        eyebrow: "Next block",
        title: `Focus on ${nextFocusTask.title}`,
        body: nextCalendarBlock
          ? `You already have ${nextCalendarBlock.title} on the calendar, so the next move is to start a real work block around it.`
          : "Your numbers are in. Stop auditing and move into execution while the runway is still clear.",
        primaryLabel: "Open focus",
        primaryAction: () => {
          localStorage.setItem(FOCUS_PREFILL_KEY, nextFocusTask.title);
          window.location.hash = "#/focus";
        },
        secondaryLabel: "Open calendar",
        secondaryAction: () => {
          window.location.hash = "#/calendar";
        },
      };
    }

    return {
      eyebrow: "Wide view",
      title: "Use today to reset the system, not just monitor it",
      body: "If there is no obvious next task, review backlog, goals, and the calendar so tomorrow starts cleaner.",
      primaryLabel: "Open today",
      primaryAction: () => {
        window.location.hash = "#/today";
      },
      secondaryLabel: "Open tasks",
      secondaryAction: () => {
        window.location.hash = "#/tasks";
      },
    };
  })();

  if (app?.tasks.loading || app?.habits.loading) {
    return <OverviewSurfaceSkeleton />;
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section
        style={{
          padding: "1.15rem 1.25rem",
          borderRadius: "20px",
          background: "linear-gradient(145deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), var(--surface))",
          border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle))",
          display: "grid",
          gap: "0.9rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "0.25rem", maxWidth: "58ch" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              {runway.eyebrow}
            </span>
            <strong style={{ fontSize: "clamp(1.05rem, 2vw, 1.35rem)" }}>{runway.title}</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {runway.body}
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={runway.primaryAction}
              style={{
                padding: "0.65rem 0.95rem",
                borderRadius: "10px",
                border: "none",
                background: "var(--accent)",
                color: "var(--text-inverted)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
              }}
            >
              {runway.primaryLabel}
            </button>
            <button
              onClick={runway.secondaryAction}
              style={{
                padding: "0.65rem 0.95rem",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)",
                background: "color-mix(in srgb, var(--surface) 76%, white 24%)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
              }}
            >
              {runway.secondaryLabel}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
          <div style={{ padding: "0.85rem 0.95rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.2rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Plan</span>
            <strong style={{ fontSize: "1.15rem" }}>{plannedToday ? "Committed" : "Missing"}</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {plannedToday ? "top tasks have been chosen today" : "run the ritual before you start reacting"}
            </span>
          </div>
          <div style={{ padding: "0.85rem 0.95rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.2rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Next task</span>
            <strong style={{ fontSize: "1.15rem" }}>{nextFocusTask ? "Ready" : "Unclear"}</strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {nextFocusTask ? nextFocusTask.title : "nothing due today is clearly leading"}
            </span>
          </div>
          <div style={{ padding: "0.85rem 0.95rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.2rem" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Calendar</span>
            <strong style={{ fontSize: "1.15rem" }}>
              {nextCalendarBlock
                ? new Date(nextCalendarBlock.start_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                : "Open"}
            </strong>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {nextCalendarBlock ? nextCalendarBlock.title : "no event block is anchoring the day"}
            </span>
          </div>
        </div>
      </section>

      {/* Packy whisper — first-class slot */}
      {app?.packy.whisper && (
        <button
          onClick={() => { window.location.hash = "#/insights"; }}
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "16px",
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.75rem",
            alignItems: "center",
            textAlign: "left",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <span style={{ fontSize: "1.2rem", color: "var(--accent)", lineHeight: 1 }}>◆</span>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {app.packy.whisper.text}
          </p>
        </button>
      )}

      {/* Live stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
        <StatCard
          label="Due today"
          value={tasksDueToday}
          sub="tasks overdue or due"
          accent={tasksDueToday > 0 ? "var(--state-warn)" : "var(--state-ok)"}
        />
        <StatCard
          label="Completed"
          value={tasksCompletedToday}
          sub="tasks done today"
          accent="var(--state-ok)"
        />
        <StatCard
          label="Focus"
          value={`${focusMinutesToday}m`}
          sub="deep work today"
          accent="var(--accent)"
        />
        <StatCard
          label="Avg streak"
          value={habitsStreakAvg}
          sub="days across habits"
          accent="#8b5cf6"
        />
      </div>

      {/* Momentum gauge */}
      {momentum && (
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderRadius: "16px",
            background: "var(--surface)",
            border: `1px solid ${momentumColor}44`,
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "1.25rem",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: `${momentumColor}22`,
              border: `3px solid ${momentumColor}`,
              display: "grid",
              placeItems: "center",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: momentumColor,
            }}
          >
            {Math.round(momentum.score)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontWeight: 700, fontSize: "1.1rem", textTransform: "capitalize" }}>{momentumLevel}</span>
              {momentum.delta_vs_yesterday !== 0 && (
                <span style={{ fontSize: "var(--text-sm)", color: momentum.delta_vs_yesterday > 0 ? "var(--state-ok)" : "var(--state-overdue)" }}>
                  {momentum.delta_vs_yesterday > 0 ? "↑" : "↓"} {Math.abs(momentum.delta_vs_yesterday)} vs yesterday
                </span>
              )}
            </div>
            <p style={{ margin: "0.25rem 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {momentum.summary}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>

        {/* Weekly digest */}
        {weeklyDigest && (
          <div style={{ padding: "1.25rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.5rem" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>This week</span>
            <span style={{ fontWeight: 700 }}>{weeklyDigest.title}</span>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.25rem" }}>
              {weeklyDigest.highlights.slice(0, 3).map((h, i) => (
                <li key={i} style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{h}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Mood drivers with mini bar chart */}
        {correlations.length > 0 && (
          <div style={{ padding: "1.25rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.75rem" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Mood drivers</span>
            {correlations.slice(0, 4).map((corr) => {
              const pct = Math.abs(corr.correlation) * 100;
              const positive = corr.correlation > 0;
              return (
                <div key={corr.habit}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span style={{ fontSize: "var(--text-sm)" }}>{corr.habit}</span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: positive ? "var(--state-ok)" : "var(--state-overdue)" }}>
                      {positive ? "+" : "−"}{pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: "4px", borderRadius: "2px", background: "var(--border-subtle)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: positive ? "var(--state-ok)" : "var(--state-overdue)", transition: "width 0.4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Top journal connections */}
        {topLinkedNodes.length > 0 && (
          <button
            onClick={() => { window.location.hash = "#/journal"; }}
            style={{ padding: "1.25rem", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border-subtle)", display: "grid", gap: "0.5rem", textAlign: "left", cursor: "pointer", width: "100%" }}
          >
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Journal connections</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {topLinkedNodes.map((node) => (
                <span key={node.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.2rem 0.6rem", borderRadius: "999px", background: "var(--accent)18", border: "1px solid var(--accent)30", fontSize: "var(--text-xs)", color: "var(--accent)", fontWeight: 600 }}>
                  {node.label}
                  <span style={{ opacity: 0.7 }}>·{node.links}</span>
                </span>
              ))}
            </div>
          </button>
        )}
      </div>

      {digestData && <DigestCard digest={digestData} />}
    </div>
  );
}
