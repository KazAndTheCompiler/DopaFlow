import type { PropsWithChildren } from "react";

export interface BadgeProps {
  tone?: "default" | "accent" | "muted";
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<BadgeProps>): JSX.Element {
  const background =
    tone === "accent" ? "var(--accent-soft)" : tone === "muted" ? "var(--surface-2)" : "var(--surface)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.25rem 0.6rem",
        borderRadius: "999px",
        background,
        border: "1px solid var(--border)",
        fontSize: "var(--text-xs)",
      }}
    >
      {children}
    </span>
  );
}

export default Badge;

