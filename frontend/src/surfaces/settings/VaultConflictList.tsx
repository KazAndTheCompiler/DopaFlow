import type { JSX } from "react";

import type { VaultConflictPreview, VaultFileRecord } from "../../../../shared/types";

import { cardStyle, diffLineStyle, labelStyle, previewText, smBtn } from "./VaultSettingsShared";

export function VaultConflictList({
  conflicts,
  previews,
  loadingId,
  errorById,
  onPreview,
  onRollback,
  onResolve,
}: {
  conflicts: VaultFileRecord[];
  previews: Record<number, VaultConflictPreview | undefined>;
  loadingId: number | null;
  errorById: Record<number, string | undefined>;
  onPreview: (id: number) => void;
  onRollback: (id: number) => void;
  onResolve: (path: string) => void;
}): JSX.Element | null {
  if (!conflicts.length) {
    return null;
  }

  const directionLabel: Record<string, string> = {
    push: "last pushed",
    pull: "last pulled",
  };

  return (
    <div style={{ ...cardStyle, borderColor: "color-mix(in srgb, var(--color-warn, #f87171) 40%, var(--border-subtle))" }}>
      <span style={{ ...labelStyle, color: "var(--color-warn, #f87171)" }}>
        {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} — both sides changed
      </span>
      {conflicts.map((conflict) => (
        <div
          key={conflict.id}
          style={{
            padding: "0.5rem 0.6rem",
            borderRadius: "10px",
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            display: "grid",
            gap: "0.3rem",
          }}
        >
          <code style={{ fontSize: "var(--text-xs)", wordBreak: "break-all" }}>{conflict.file_path}</code>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              {conflict.entity_type} · {conflict.entity_id}
            </span>
            {conflict.last_direction && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                {directionLabel[conflict.last_direction] ?? conflict.last_direction}
                {conflict.last_synced_at ? ` ${conflict.last_synced_at.slice(0, 16).replace("T", " ")}` : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {smBtn(
              () => onPreview(conflict.id),
              loadingId === conflict.id
                ? "Loading preview…"
                : previews[conflict.id]
                  ? "Hide preview"
                  : "Preview changes",
              false,
              loadingId === conflict.id
            )}
            {smBtn(() => onRollback(conflict.id), "Rollback to DopaFlow")}
            {smBtn(() => onResolve(conflict.file_path), "Keep vault version")}
          </div>
          {errorById[conflict.id] && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-warn, #f87171)" }}>
              {errorById[conflict.id]}
            </span>
          )}
          {previews[conflict.id] && (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Snapshot is the last DopaFlow-indexed version. Vault is the current file on disk.
              </span>
              <div style={{ display: "grid", gap: "0.25rem" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Diff summary
                </span>
                <div
                  style={{
                    margin: 0,
                    padding: "0.6rem",
                    borderRadius: "8px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "11px",
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                    maxHeight: "12rem",
                    fontFamily: "monospace",
                  }}
                >
                  {(previews[conflict.id]?.diff_lines.length ?? 0) > 0 ? (
                    previews[conflict.id]?.diff_lines.map((line, index) => (
                      <div key={`${conflict.id}-diff-${index}`} style={diffLineStyle(line)}>
                        {line}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "var(--text-secondary)" }}>No textual diff available.</div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "0.5rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
                }}
              >
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600 }}>
                    Current vault
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      padding: "0.6rem",
                      borderRadius: "8px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "11px",
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                      maxHeight: "15rem",
                    }}
                  >
                    {previews[conflict.id]?.current_exists
                      ? previewText(previews[conflict.id]?.current_body ?? null)
                      : "Vault file is missing."}
                  </pre>
                </div>
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 600 }}>
                    Last DopaFlow snapshot
                  </span>
                  <pre
                    style={{
                      margin: 0,
                      padding: "0.6rem",
                      borderRadius: "8px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "11px",
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                      maxHeight: "15rem",
                    }}
                  >
                    {previewText(previews[conflict.id]?.snapshot_body ?? null)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
