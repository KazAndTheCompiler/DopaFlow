import type { CSSProperties } from "react";

export const primaryBtn: CSSProperties = {
  padding: "0.72rem 1.25rem",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))",
  color: "var(--text-inverted)",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "var(--text-sm)",
  boxShadow: "var(--shadow-soft)",
};

export const secondaryBtn: CSSProperties = {
  padding: "0.72rem 1rem",
  borderRadius: "12px",
  border: "1px solid var(--border-subtle)",
  background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
};

export const STEP_TITLES = ["Wins", "Defer", "Tomorrow"];
export const TOTAL_STEPS = 3;

export const EMOJI_CHOICES = [
  { emoji: "😤", label: "Rough" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😐", label: "Okay" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😄", label: "Great" },
  { emoji: "🤩", label: "Amazing" },
] as const;
