import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState } from "@ds/primitives/EmptyState";
import { SkeletonCard } from "@ds/primitives/Skeleton";
import type { Goal, GoalMilestone } from "@api/goals";
import { addMilestone, completeMilestone, createGoal, deleteGoal, listGoals } from "@api/goals";

const GOAL_STYLES = `
  .goal-input:focus {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--focus-ring) !important;
    outline: none;
  }
  .goal-input:hover {
    border-color: var(--border) !important;
  }
  .goal-select:focus {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--focus-ring) !important;
    outline: none;
  }
  .goal-textarea:focus {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--focus-ring) !important;
    outline: none;
  }
  .goal-textarea:hover, .goal-select:hover {
    border-color: var(--border) !important;
  }
`;

if (typeof document !== "undefined" && !document.getElementById("goal-view-styles")) {
  const style = document.createElement("style");
  style.id = "goal-view-styles";
  style.innerHTML = GOAL_STYLES;
  document.head.appendChild(style);
}

function showToast(message: string, type: "error" | "warn"): void {
  window.dispatchEvent(new CustomEvent("dopaflow:toast", { detail: { id: Date.now(), message, type } }));
}

export default function GoalsView(): JSX.Element {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [horizon, setHorizon] = useState<Goal["horizon"]>("quarter");
  const [milestoneInput, setMilestoneInput] = useState("");
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const [addingMilestoneTo, setAddingMilestoneTo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listGoals();
      setGoals(data);
    } catch {
      showToast("Failed to load goals", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleCreate = async (): Promise<void> => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const milestone_labels = milestoneInput
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      await createGoal({ title: trimmed, description: description.trim() || undefined, horizon, milestone_labels });
      setTitle("");
      setDescription("");
      setMilestoneInput("");
      setHorizon("quarter");
      await refresh();
      showToast("Goal created", "warn");
    } catch {
      showToast("Failed to create goal", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteMilestone = async (goalId: string, milestoneId: string): Promise<void> => {
    try {
      const updated = await completeMilestone(goalId, milestoneId);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
    } catch {
      showToast("Failed to complete milestone", "error");
    }
  };

  const handleAddMilestone = async (goalId: string): Promise<void> => {
    const label = newMilestoneLabel.trim();
    if (!label) return;
    try {
      const updated = await addMilestone(goalId, label);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
      setNewMilestoneLabel("");
      setAddingMilestoneTo(null);
    } catch {
      showToast("Failed to add milestone", "error");
    }
  };

  const handleDelete = async (goalId: string): Promise<void> => {
    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      showToast("Goal deleted", "warn");
    } catch {
      showToast("Failed to delete goal", "error");
    }
  };

  const inputStyle = {
    padding: "0.5rem 0.75rem",
    borderRadius: "10px",
    border: "1px solid var(--border-subtle)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    fontSize: "var(--text-sm)",
    transition: "border-color 180ms ease, box-shadow 180ms ease",
    outline: "none",
  };

  const cardStyle = {
    padding: "1.25rem",
    background: "var(--surface)",
    borderRadius: "18px",
    border: "1px solid var(--border-subtle)",
    transition: "box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease",
  };

  const btnStyle = {
    transition: "background 180ms ease, transform 150ms ease, box-shadow 180ms ease",
  };

  const progressPct = (goal: Goal): number => {
    if (goal.milestones.length === 0) return 0;
    return Math.round((goal.milestones.filter((m) => m.done).length / goal.milestones.length) * 100);
  };

  const horizonLabel: Record<string, string> = { week: "This week", month: "This month", quarter: "This quarter", year: "This year" };
  const horizonColor: Record<string, string> = { week: "var(--state-ok)", month: "var(--accent)", quarter: "var(--state-warn)", year: "var(--state-conflict)" };

  if (loading) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <SkeletonCard height="60px" />
        <SkeletonCard height="60px" />
        <SkeletonCard height="60px" />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {/* Create form */}
      <section
        style={{
          ...cardStyle,
          display: "grid",
          gap: "0.85rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.06em", color: "var(--accent)" }}>GL</span>
          <strong style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)" }}>New goal</strong>
        </div>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Title</label>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            placeholder="e.g. Launch side project"
            style={inputStyle}
            className="goal-input"
          />
        </div>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does success look like?"
            rows={2}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            className="goal-textarea"
          />
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Horizon</label>
            <select value={horizon} onChange={(e) => setHorizon(e.target.value as Goal["horizon"])} style={{ ...inputStyle, cursor: "pointer" }} className="goal-select">
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
            </select>
          </div>
          <div style={{ flex: "1 1 280px", display: "grid", gap: "0.4rem" }}>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Milestones (one per line)</label>
            <textarea
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
              placeholder={"Research\nBuild MVP\nLaunch"}
              rows={2}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              className="goal-textarea"
            />
          </div>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={!title.trim() || creating}
          style={{
            ...btnStyle,
            padding: "0.55rem 1.4rem",
            borderRadius: "10px",
            border: "none",
            background: title.trim() ? "var(--accent)" : "var(--border-subtle)",
            color: "var(--text-inverted)",
            cursor: title.trim() ? "pointer" : "not-allowed",
            fontWeight: 600,
            alignSelf: "start",
            fontSize: "var(--text-sm)",
            boxShadow: title.trim() ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
          }}
          onMouseEnter={(e) => {
            if (title.trim()) {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (title.trim()) {
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          {creating ? "…" : "+ Create goal"}
        </button>
      </section>

      {/* Goals list */}
      {goals.length === 0 ? (
        <EmptyState
          icon="GL"
          title="No goals yet"
          subtitle="Set a long-term goal and break it into milestones to track progress."
        />
      ) : (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {goals.map((goal) => {
            const pct = progressPct(goal);
            const isExpanded = expandedGoalId === goal.id;
            return (
              <section
                key={goal.id}
                style={{
                  ...cardStyle,
                  borderColor: goal.done ? "var(--state-ok)" : "var(--border-subtle)",
                  display: "grid",
                  gap: "0.75rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-elevated)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1rem", color: "var(--text-primary)", textDecoration: goal.done ? "line-through" : "none" }}>
                        {goal.title}
                      </strong>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "0.15rem 0.55rem",
                          borderRadius: "999px",
                          background: horizonColor[goal.horizon] + "22",
                          color: horizonColor[goal.horizon],
                          fontWeight: 600,
                        }}
                      >
                        {horizonLabel[goal.horizon]}
                      </span>
                      {goal.done && (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--state-ok)", fontWeight: 700 }}>OK Done</span>
                      )}
                    </div>
                    {goal.description && (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "var(--text-sm)", color: pct === 100 ? "var(--state-ok)" : "var(--text-secondary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                    <button
                      onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                      style={{
                        ...btnStyle,
                        background: isExpanded ? "var(--accent-soft)" : "transparent",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "8px",
                        color: isExpanded ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer",
                        padding: "0.25rem 0.6rem",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--accent-soft)";
                        e.currentTarget.style.color = "var(--accent)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--text-secondary)";
                        }
                      }}
                    >
                      {isExpanded ? "▾ Hide" : "▸ Details"}
                    </button>
                    <button
                      onClick={() => void handleDelete(goal.id)}
                      style={{
                        ...btnStyle,
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: "8px",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: "0.25rem 0.5rem",
                        fontSize: "var(--text-xs)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--state-overdue)";
                        e.currentTarget.style.color = "var(--state-overdue)";
                        e.currentTarget.style.background = "var(--state-overdue)" + "18";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "transparent";
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      X
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: "6px", borderRadius: "999px", background: "var(--surface-2)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: pct === 100 ? "var(--state-ok)" : "var(--accent)",
                      transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
                      borderRadius: "999px",
                    }}
                  />
                </div>

                {/* Milestones */}
                {isExpanded && (
                  <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.25rem" }}>
                    {goal.milestones.length === 0 && (
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No milestones yet.</span>
                    )}
                    {goal.milestones.map((m: GoalMilestone) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "10px",
                          background: m.done ? "var(--state-ok)" + "18" : "var(--surface-2)",
                          cursor: m.done ? "default" : "pointer",
                          transition: "background 180ms ease, transform 150ms ease",
                        }}
                        onClick={() => {
                          if (!m.done) void handleCompleteMilestone(goal.id, m.id);
                        }}
                        onMouseEnter={(e) => {
                          if (!m.done) {
                            e.currentTarget.style.background = "var(--accent-soft)";
                            e.currentTarget.style.transform = "translateX(2px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!m.done) {
                            e.currentTarget.style.background = "var(--surface-2)";
                            e.currentTarget.style.transform = "translateX(0)";
                          }
                        }}
                      >
                        <span
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            border: `2px solid ${m.done ? "var(--state-ok)" : "var(--border)"}`,
                            background: m.done ? "var(--state-ok)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            color: "var(--text-inverted)",
                            flexShrink: 0,
                            transition: "all 200ms ease",
                          }}
                        >
                          {m.done ? "OK" : ""}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--text-sm)",
                            color: m.done ? "var(--text-secondary)" : "var(--text-primary)",
                            textDecoration: m.done ? "line-through" : "none",
                            transition: "color 180ms ease",
                          }}
                        >
                          {m.label}
                        </span>
                        {m.completed_at && (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                            {new Date(m.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Add milestone inline */}
                    {addingMilestoneTo === goal.id ? (
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", alignItems: "center" }}>
                        <input
                          value={newMilestoneLabel}
                          onChange={(e) => setNewMilestoneLabel(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && void handleAddMilestone(goal.id)}
                          placeholder="Milestone label"
                          autoFocus
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                          onClick={() => void handleAddMilestone(goal.id)}
                          style={{
                            ...btnStyle,
                            padding: "0.4rem 0.85rem",
                            borderRadius: "8px",
                            border: "none",
                            background: "var(--accent)",
                            color: "var(--text-inverted)",
                            cursor: "pointer",
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setAddingMilestoneTo(null);
                            setNewMilestoneLabel("");
                          }}
                          style={{
                            ...btnStyle,
                            padding: "0.4rem 0.85rem",
                            borderRadius: "8px",
                            border: "1px solid var(--border-subtle)",
                            background: "transparent",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingMilestoneTo(goal.id)}
                        style={{
                          ...btnStyle,
                          marginTop: "0.35rem",
                          padding: "0.4rem 0.85rem",
                          borderRadius: "10px",
                          border: "1px dashed var(--border-subtle)",
                          background: "transparent",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: "var(--text-xs)",
                          fontWeight: 500,
                          alignSelf: "start",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--accent)";
                          e.currentTarget.style.color = "var(--accent)";
                          e.currentTarget.style.background = "var(--accent-soft)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-subtle)";
                          e.currentTarget.style.color = "var(--text-secondary)";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        + Add milestone
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
