import { useState } from "react";

import type { Goal, GoalMilestone } from "@api/goals";

import { goalButtonStyle, goalCardStyle, goalInputStyle, horizonColor, horizonLabel, progressPct } from "./GoalsShared";

interface GoalCardProps {
  goal: Goal;
  expanded: boolean;
  onToggleExpanded: () => void;
  onDelete: () => void;
  onCompleteMilestone: (milestoneId: string) => void;
  onAddMilestone: (label: string) => void;
}

export function GoalCard({
  goal,
  expanded,
  onToggleExpanded,
  onDelete,
  onCompleteMilestone,
  onAddMilestone,
}: GoalCardProps): JSX.Element {
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const pct = progressPct(goal);

  const handleAddMilestone = (): void => {
    const label = newMilestoneLabel.trim();
    if (!label) {
      return;
    }
    onAddMilestone(label);
    setNewMilestoneLabel("");
    setAddingMilestone(false);
  };

  return (
    <section
      style={{
        ...goalCardStyle,
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
            <strong style={{ fontSize: "1rem", color: "var(--text-primary)", textDecoration: goal.done ? "line-through" : "none" }}>{goal.title}</strong>
            <span
              style={{
                fontSize: "var(--text-xs)",
                padding: "0.15rem 0.55rem",
                borderRadius: "999px",
                background: `${horizonColor[goal.horizon]}22`,
                color: horizonColor[goal.horizon],
                fontWeight: 600,
              }}
            >
              {horizonLabel[goal.horizon]}
            </span>
            {goal.done && <span style={{ fontSize: "var(--text-xs)", color: "var(--state-ok)", fontWeight: 700 }}>OK Done</span>}
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
            onClick={onToggleExpanded}
            style={{
              ...goalButtonStyle,
              background: expanded ? "var(--accent-soft)" : "transparent",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: expanded ? "var(--accent)" : "var(--text-secondary)",
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
              if (!expanded) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            {expanded ? "▾ Hide" : "▸ Details"}
          </button>
          <button
            onClick={onDelete}
            style={{
              ...goalButtonStyle,
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
              e.currentTarget.style.background = "var(--state-overdue)18";
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

      {expanded && (
        <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.25rem" }}>
          {goal.milestones.length === 0 && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No milestones yet.</span>}
          {goal.milestones.map((milestone: GoalMilestone) => (
            <div
              key={milestone.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "10px",
                background: milestone.done ? "var(--state-ok)18" : "var(--surface-2)",
                cursor: milestone.done ? "default" : "pointer",
                transition: "background 180ms ease, transform 150ms ease",
              }}
              onClick={() => {
                if (!milestone.done) {
                  onCompleteMilestone(milestone.id);
                }
              }}
              onMouseEnter={(e) => {
                if (!milestone.done) {
                  e.currentTarget.style.background = "var(--accent-soft)";
                  e.currentTarget.style.transform = "translateX(2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!milestone.done) {
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
                  border: `2px solid ${milestone.done ? "var(--state-ok)" : "var(--border)"}`,
                  background: milestone.done ? "var(--state-ok)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  color: "var(--text-inverted)",
                  flexShrink: 0,
                  transition: "all 200ms ease",
                }}
              >
                {milestone.done ? "OK" : ""}
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: milestone.done ? "var(--text-secondary)" : "var(--text-primary)",
                  textDecoration: milestone.done ? "line-through" : "none",
                  transition: "color 180ms ease",
                }}
              >
                {milestone.label}
              </span>
              {milestone.completed_at && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                  {new Date(milestone.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}

          {addingMilestone ? (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", alignItems: "center" }}>
              <input
                value={newMilestoneLabel}
                onChange={(e) => setNewMilestoneLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
                placeholder="Milestone label"
                autoFocus
                style={{ ...goalInputStyle, flex: 1 }}
              />
              <button
                onClick={handleAddMilestone}
                style={{
                  ...goalButtonStyle,
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
                  setAddingMilestone(false);
                  setNewMilestoneLabel("");
                }}
                style={{
                  ...goalButtonStyle,
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
              onClick={() => setAddingMilestone(true)}
              style={{
                ...goalButtonStyle,
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
}
