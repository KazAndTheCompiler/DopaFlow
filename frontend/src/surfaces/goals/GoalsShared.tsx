import type { CSSProperties, RefObject } from "react";

import type { Goal } from "@api/goals";
import { fire } from "../../app/toastService";

export const GOAL_STYLES = `
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

export function ensureGoalStyles(): void {
  if (
    typeof document === "undefined" ||
    document.getElementById("goal-view-styles")
  ) {
    return;
  }
  const style = document.createElement("style");
  style.id = "goal-view-styles";
  style.innerHTML = GOAL_STYLES;
  document.head.appendChild(style);
}

export function showGoalToast(message: string, type: "error" | "warn"): void {
  fire(message, type);
}

export const goalInputStyle: CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: "10px",
  border: "1px solid var(--border-subtle)",
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  transition: "border-color 180ms ease, box-shadow 180ms ease",
  outline: "none",
};

export const goalCardStyle: CSSProperties = {
  padding: "1.25rem",
  background: "var(--surface)",
  borderRadius: "18px",
  border: "1px solid var(--border-subtle)",
  transition:
    "box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease",
};

export const goalButtonStyle: CSSProperties = {
  transition:
    "background 180ms ease, transform 150ms ease, box-shadow 180ms ease",
};

export const horizonLabel: Record<string, string> = {
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
};

export const horizonColor: Record<string, string> = {
  week: "var(--state-ok)",
  month: "var(--accent)",
  quarter: "var(--state-warn)",
  year: "var(--state-conflict)",
};

export function progressPct(goal: Goal): number {
  if (goal.milestones.length === 0) {
    return 0;
  }
  return Math.round(
    (goal.milestones.filter((milestone) => milestone.done).length /
      goal.milestones.length) *
      100,
  );
}

export interface GoalCreateDraft {
  title: string;
  description: string;
  horizon: Goal["horizon"];
  milestoneInput: string;
}

export interface GoalCreateFormProps extends GoalCreateDraft {
  creating: boolean;
  inputRef: RefObject<HTMLInputElement>;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onHorizonChange: (value: Goal["horizon"]) => void;
  onMilestoneInputChange: (value: string) => void;
  onCreate: () => void;
}
