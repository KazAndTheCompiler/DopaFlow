import type { CSSProperties, JSX } from "react";

export const cardStyle: CSSProperties = {
  padding: "0.85rem 1rem",
  borderRadius: "14px",
  background: "var(--surface-2)",
  border: "1px solid var(--border-subtle)",
  display: "grid",
  gap: "0.6rem",
};

export const labelStyle: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  fontWeight: 600,
};

export function StatusDot({ ok }: { ok: boolean }): JSX.Element {
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.55rem",
        height: "0.55rem",
        borderRadius: "50%",
        background: ok ? "var(--color-success, #4ade80)" : "var(--color-warn, #f87171)",
        marginRight: "0.4rem",
      }}
    />
  );
}

export function SyncRow({
  label,
  description,
  onPush,
  onPull,
  disabled,
}: {
  label: string;
  description: string;
  onPush: () => void;
  onPull: () => void;
  disabled: boolean;
}): JSX.Element {
  const btn = (text: string, onClick: () => void, primary = false): JSX.Element => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.35rem 0.8rem",
        borderRadius: "8px",
        border: primary ? "none" : "1px solid var(--border)",
        background: primary ? "var(--accent)" : "transparent",
        color: primary ? "var(--text-inverted)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{description}</div>
      </div>
      {btn("Push", onPush, true)}
      {btn("Pull", onPull)}
    </div>
  );
}

export function smBtn(
  onClick: () => void,
  text: string,
  primary = false,
  disabled = false
): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.3rem 0.65rem",
        borderRadius: "7px",
        border: primary ? "none" : "1px solid var(--border)",
        background: primary ? "var(--accent)" : "transparent",
        color: primary ? "var(--text-inverted)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {text}
    </button>
  );
}

export function previewText(body: string | null): string {
  if (body === null) {
    return "No saved snapshot available.";
  }
  return body.trim() ? body : "(empty file)";
}

export function diffLineStyle(line: string): CSSProperties {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return { color: "var(--color-success, #4ade80)" };
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return { color: "var(--color-warn, #f87171)" };
  }
  if (line.startsWith("@@")) {
    return { color: "var(--accent)" };
  }
  return { color: "var(--text-secondary)" };
}
