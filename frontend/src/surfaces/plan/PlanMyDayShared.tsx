import type { CSSProperties } from "react";

import type { Task } from "@shared/types";
import { APP_STORAGE_KEYS } from "../../app/appStorage";

export const TODAY_KEY = APP_STORAGE_KEYS.plannedDate;
export const MAX_PICKS = 3;

export const ENERGY_LEVELS = [
  { code: "😓", label: "Drained", value: 0 },
  { code: "😐", label: "Low", value: 1 },
  { code: "🙂", label: "Okay", value: 2 },
  { code: "😄", label: "Good", value: 3 },
  { code: "⚡", label: "Peak", value: 4 },
] as const;
export const STEP_TITLES = ["Energy", "Yesterday", "Pick your 3", "Commit"];
export const TOTAL_STEPS = 4;

export const primaryBtn: CSSProperties = {
  padding: "0.72rem 1.25rem",
  borderRadius: "12px",
  border: "none",
  background:
    "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))",
  color: "var(--text-inverted)",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "var(--text-sm)",
  boxShadow: "var(--shadow-soft)",
};

export const disabledBtn: CSSProperties = {
  ...primaryBtn,
  background: "var(--border-subtle)",
  cursor: "not-allowed",
  opacity: 0.5,
  boxShadow: "none",
};

export const ghostBtn: CSSProperties = {
  padding: "0.72rem 1rem",
  borderRadius: "12px",
  border: "1px solid var(--border-subtle)",
  background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayISO(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isOverdue(task: Task): boolean {
  if (!task.due_at) {
    return false;
  }
  return task.due_at.slice(0, 10) < todayISO();
}
