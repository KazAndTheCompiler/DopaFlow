import { useState } from "react";
import type { JSX } from "react";

import { confirmTaskImport, previewTaskImport } from "@api/index";
import type { TaskImportPreview } from "../../../../shared/types";

import { cardStyle, labelStyle, smBtn } from "./VaultSettingsShared";

export function VaultTaskImportPanel({
  disabled,
}: {
  disabled: boolean;
}): JSX.Element {
  const [preview, setPreview] = useState<TaskImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const scan = (): void => {
    setScanning(true);
    setMsg(null);
    setPreview(null);
    setSelected(new Set());
    void previewTaskImport()
      .then((nextPreview) => {
        setPreview(nextPreview);
        setSelected(new Set(nextPreview.importable.map((_, index) => index)));
        setScanning(false);
      })
      .catch((error: unknown) => {
        setMsg(
          `Scan failed: ${error instanceof Error ? error.message : "unknown"}`,
        );
        setScanning(false);
      });
  };

  const toggleAll = (): void => {
    if (!preview) {
      return;
    }
    if (selected.size === preview.importable.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(preview.importable.map((_, index) => index)));
  };

  const doImport = (): void => {
    if (!preview) {
      return;
    }

    const toImport = preview.importable.filter((_, index) =>
      selected.has(index),
    );
    if (!toImport.length) {
      return;
    }

    setImporting(true);
    setMsg(null);
    void confirmTaskImport(toImport)
      .then((response) => {
        const errorText = response.errors.length
          ? ` Errors: ${response.errors.slice(0, 2).join("; ")}`
          : "";
        setMsg(`Imported ${response.imported} tasks.${errorText}`);
        setPreview(null);
        setSelected(new Set());
        setImporting(false);
      })
      .catch((error: unknown) => {
        setMsg(
          `Import failed: ${error instanceof Error ? error.message : "unknown"}`,
        );
        setImporting(false);
      });
  };

  const busy = scanning || importing || disabled;

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <span style={labelStyle}>Import tasks from vault</span>
        {smBtn(scan, scanning ? "Scanning…" : "Scan", false, busy)}
      </div>
      <span
        style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}
      >
        Finds task lines in your vault task files that are not yet in DopaFlow.
        Review before importing.
      </span>

      {preview && (
        <>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
            }}
          >
            {preview.total_scanned} scanned · {preview.importable.length}{" "}
            importable · {preview.known.length} already known ·{" "}
            {preview.skipped} skipped
          </div>

          {preview.importable.length > 0 ? (
            <div style={{ display: "grid", gap: "0.3rem" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    fontSize: "var(--text-xs)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.size === preview.importable.length}
                    onChange={toggleAll}
                  />
                  Select all
                </label>
                <span style={{ marginLeft: "auto" }}>
                  {smBtn(
                    doImport,
                    importing ? "Importing…" : `Import ${selected.size}`,
                    true,
                    importing || selected.size === 0,
                  )}
                </span>
              </div>
              <div
                style={{
                  maxHeight: "14rem",
                  overflowY: "auto",
                  display: "grid",
                  gap: "0.2rem",
                }}
              >
                {preview.importable.map((candidate, index) => (
                  <label
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                      padding: "0.3rem 0.4rem",
                      borderRadius: "6px",
                      background: selected.has(index)
                        ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                        : "transparent",
                      cursor: "pointer",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(index)}
                      onChange={() => {
                        const nextSelected = new Set(selected);
                        if (nextSelected.has(index)) {
                          nextSelected.delete(index);
                        } else {
                          nextSelected.add(index);
                        }
                        setSelected(nextSelected);
                      }}
                      style={{ marginTop: "0.1rem", flexShrink: 0 }}
                    />
                    <div>
                      <span style={{ fontWeight: 600 }}>{candidate.title}</span>
                      {candidate.due_str && (
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            marginLeft: "0.4rem",
                          }}
                        >
                          📅 {candidate.due_str}
                        </span>
                      )}
                      {candidate.tags.length > 0 && (
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            marginLeft: "0.4rem",
                          }}
                        >
                          {candidate.tags.map((tag) => `#${tag}`).join(" ")}
                        </span>
                      )}
                      {candidate.project_name && (
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            marginLeft: "0.4rem",
                          }}
                        >
                          · {candidate.project_name}
                        </span>
                      )}
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          marginLeft: "0.4rem",
                          fontFamily: "monospace",
                        }}
                      >
                        {candidate.file_path}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
              }}
            >
              No new importable tasks found.
            </span>
          )}
        </>
      )}

      {msg && (
        <span
          style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
