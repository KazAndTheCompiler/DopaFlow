import { useEffect, useMemo } from "react";

import type { MomentumScore } from "../../../../shared/types";
import { useAppFocus, useAppInsights, useAppTasks } from "../../app/AppContexts";
import type { CorrelationInsight, WeeklyDigest } from "@api/insights";

interface TaskVelocityData {
  completionRate: number;
  avgDaysToComplete: number | null;
  overdueRate: number;
}

function TaskVelocityCard({ data }: { data: TaskVelocityData }): JSX.Element {
  const { completionRate, avgDaysToComplete, overdueRate } = data;
  const rateColor = completionRate >= 70 ? "var(--state-completed)" : completionRate >= 40 ? "var(--accent)" : "var(--state-overdue)";

  return (
    <section style={{
      padding: "1.5rem",
      borderRadius: "20px",
      background: "var(--surface)",
      border: "1px solid var(--border-subtle)",
      display: "grid",
      gap: "1rem",
    }}>
      <strong style={{ fontSize: "var(--text-lg)" }}>Task velocity</strong>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Completion rate</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginTop: "0.35rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: rateColor, lineHeight: 1 }}>
              {completionRate.toFixed(0)}%
            </span>
          </div>
        </div>
        {avgDaysToComplete !== null && (
          <div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg to complete</span>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)", lineHeight: 1, marginTop: "0.35rem" }}>
              {avgDaysToComplete.toFixed(1)}<span style={{ fontSize: "var(--text-sm)", fontWeight: 400 }}>d</span>
            </div>
          </div>
        )}
      </div>
      {overdueRate > 20 && (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.25rem 0.65rem",
          borderRadius: "999px",
          background: "var(--state-overdue)18",
          border: "1px solid var(--state-overdue)40",
          color: "var(--state-overdue)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          justifySelf: "start",
        }}>
          ⚠ {overdueRate.toFixed(0)}% overdue
        </span>
      )}
    </section>
  );
}

interface FocusPatternData {
  hourlyCounts: number[];
  avgSessionMinutes: number | null;
  totalFocusHours: number;
}

function FocusPatternsCard({ data }: { data: FocusPatternData }): JSX.Element {
  const { hourlyCounts, avgSessionMinutes, totalFocusHours } = data;
  const maxCount = Math.max(...hourlyCounts, 1);

  return (
    <section style={{
      padding: "1.5rem",
      borderRadius: "20px",
      background: "var(--surface)",
      border: "1px solid var(--border-subtle)",
      display: "grid",
      gap: "1rem",
    }}>
      <strong style={{ fontSize: "var(--text-lg)" }}>Focus patterns</strong>
      <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "36px" }}>
        {hourlyCounts.map((count, hour) => {
          const intensity = count / maxCount;
          return (
            <div
              key={hour}
              title={`${hour}:00 — ${count} session${count !== 1 ? "s" : ""}`}
              style={{
                flex: 1,
                height: `${Math.max(intensity * 100, count > 0 ? 10 : 4)}%`,
                borderRadius: "2px",
                background: count > 0
                  ? `color-mix(in srgb, var(--accent) ${Math.round(30 + intensity * 70)}%, transparent)`
                  : "var(--border-subtle)",
                transition: "height 300ms ease",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", fontSize: "var(--text-xs)", color: "var(--text-muted)", justifyContent: "space-between" }}>
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total focus</span>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)", lineHeight: 1, marginTop: "0.25rem" }}>
            {totalFocusHours.toFixed(1)}<span style={{ fontSize: "var(--text-sm)", fontWeight: 400 }}>h</span>
          </div>
        </div>
        {avgSessionMinutes !== null && (
          <div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg session</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)", lineHeight: 1, marginTop: "0.25rem" }}>
              {Math.round(avgSessionMinutes)}<span style={{ fontSize: "var(--text-sm)", fontWeight: 400 }}>m</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MomentumCard({ momentum }: { momentum?: MomentumScore | undefined }): JSX.Element {
  const score = momentum?.score ?? 0;
  const label = momentum?.summary ?? "Loading...";

  return (
    <section style={{
      padding: "1.5rem",
      borderRadius: "20px",
      background: "var(--surface)",
      border: "1px solid var(--border-subtle)",
      display: "grid",
      gap: "1rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ fontSize: "var(--text-lg)" }}>Momentum</strong>
        <span style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: score >= 70 ? "var(--state-completed)" : score >= 40 ? "var(--accent)" : "var(--state-overdue)",
        }}>
          {score}
        </span>
      </div>
      <div style={{
        height: "8px",
        borderRadius: "999px",
        background: "var(--surface-2)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${score}%`,
          height: "100%",
          background: score >= 70 ? "var(--state-completed)" : score >= 40 ? "var(--accent)" : "var(--state-overdue)",
          transition: "width 500ms ease",
        }} />
      </div>
      <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{label}</span>
    </section>
  );
}

function WeeklyDigestCard({ digest }: { digest?: WeeklyDigest | undefined }): JSX.Element {
  return (
    <section style={{
      padding: "1.5rem",
      borderRadius: "20px",
      background: "var(--surface)",
      border: "1px solid var(--border-subtle)",
      display: "grid",
      gap: "1rem",
    }}>
      <strong style={{ fontSize: "var(--text-lg)" }}>{digest?.title ?? "Weekly Digest"}</strong>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {digest?.highlights?.length ? (
          digest.highlights.map((highlight, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent)" }}>•</span>
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{highlight}</span>
            </div>
          ))
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>No highlights yet.</span>
        )}
      </div>
    </section>
  );
}

function CorrelationsCard({ correlations }: { correlations: CorrelationInsight[] }): JSX.Element {
  return (
    <section style={{
      padding: "1.5rem",
      borderRadius: "20px",
      background: "var(--surface)",
      border: "1px solid var(--border-subtle)",
      display: "grid",
      gap: "1rem",
    }}>
      <strong style={{ fontSize: "var(--text-lg)" }}>Trends & Correlations</strong>
      <div style={{ display: "grid", gap: "1rem" }}>
        {correlations.length ? (
          correlations.map((correlation) => {
            const value = Number(correlation.pearson_r ?? 0);
            const isPositive = value >= 0;
            const color = isPositive ? "var(--state-completed)" : "var(--state-overdue)";

            return (
              <div key={correlation.metric} style={{ display: "grid", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{correlation.metric}</span>
                  <span style={{ fontSize: "var(--text-xs)", color, fontWeight: 600 }}>
                    {isPositive ? "+" : ""}{value.toFixed(2)}
                  </span>
                </div>
                <div style={{
                  height: "6px",
                  borderRadius: "999px",
                  background: "var(--surface-2)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.abs(value) * 100}%`,
                    height: "100%",
                    background: color,
                    marginLeft: value < 0 ? "auto" : 0,
                    transition: "width 300ms ease",
                  }} />
                </div>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                  {correlation.interpretation}
                </span>
              </div>
            );
          })
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            No correlations yet — check back after a few days of tracking.
          </span>
        )}
      </div>
    </section>
  );
}

export default function InsightsView(): JSX.Element {
  const insights = useAppInsights();
  const focus = useAppFocus();
  const tasks = useAppTasks();

  useEffect(() => {
    void insights.refresh();
  }, [insights]);

  const focusPatterns = useMemo((): FocusPatternData => {
    const sessions = focus.sessions;
    const completed = sessions.filter((s) => s.status === "completed");

    const hourlyCounts = Array(24).fill(0) as number[];
    for (const s of completed) {
      if (s.started_at) {
        const hour = new Date(s.started_at).getHours();
        hourlyCounts[hour] = (hourlyCounts[hour] ?? 0) + 1;
      }
    }

    const durations = completed
      .map((s) => s.duration_minutes)
      .filter((d) => d > 0);
    const avgSessionMinutes = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

    const totalFocusHours = durations.reduce((a, b) => a + b, 0) / 60;

    return { hourlyCounts, avgSessionMinutes, totalFocusHours };
  }, [focus.sessions]);

  const taskVelocity = useMemo((): TaskVelocityData => {
    const total = tasks.tasks.length;
    const done = tasks.tasks.filter((t) => t.done);
    const completionRate = total > 0 ? (done.length / total) * 100 : 0;

    const durations = done
      .filter((t) => t.created_at && t.updated_at)
      .map((t) => (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86400000);
    const avgDaysToComplete = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

    const now = new Date().toISOString().slice(0, 10);
    const pending = tasks.tasks.filter((t) => !t.done);
    const overdue = pending.filter((t) => t.due_at && t.due_at.slice(0, 10) < now);
    const overdueRate = pending.length > 0 ? (overdue.length / pending.length) * 100 : 0;

    return { completionRate, avgDaysToComplete, overdueRate };
  }, [tasks.tasks]);

  const { momentum, weeklyDigest, correlations } = insights;

  return (
    <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <MomentumCard momentum={momentum} />
      <WeeklyDigestCard digest={weeklyDigest} />
      <TaskVelocityCard data={taskVelocity} />
      <FocusPatternsCard data={focusPatterns} />
      <div style={{ gridColumn: "1 / -1" }}>
        <CorrelationsCard correlations={correlations} />
      </div>
    </div>
  );
}
