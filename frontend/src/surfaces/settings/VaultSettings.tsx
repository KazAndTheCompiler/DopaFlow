import { useEffect, useState } from "react";

import {
  getVaultStatus,
  updateVaultConfig,
  pushJournal,
  pullJournal,
  pushTasks,
  pullTasks,
  pushDailyTasksSection,
  previewTaskImport,
  confirmTaskImport,
  getVaultConflicts,
  getVaultConflictPreview,
  rollbackVaultFile,
  resolveVaultConflict,
} from "@api/index";
import type {
  VaultConflictPreview,
  VaultStatus,
  VaultFileRecord,
  TaskImportPreview,
} from "../../../../shared/types";

type SyncState = "idle" | "working" | "done" | "error";

function StatusDot({ ok }: { ok: boolean }): JSX.Element {
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

function SyncRow({
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

const cardStyle: React.CSSProperties = {
  padding: "0.85rem 1rem",
  borderRadius: "14px",
  background: "var(--surface-2)",
  border: "1px solid var(--border-subtle)",
  display: "grid",
  gap: "0.6rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  fontWeight: 600,
};

function smBtn(onClick: () => void, text: string, primary = false, disabled = false): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.3rem 0.65rem", borderRadius: "7px",
        border: primary ? "none" : "1px solid var(--border)",
        background: primary ? "var(--accent)" : "transparent",
        color: primary ? "var(--text-inverted)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "var(--text-xs)", fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
      }}
    >{text}</button>
  );
}

function previewText(body: string | null): string {
  if (body === null) return "No saved snapshot available.";
  return body.trim() ? body : "(empty file)";
}

function diffLineStyle(line: string): React.CSSProperties {
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

// ── Daily task section panel ──────────────────────────────────────────────────

function DailyTaskSection({ disabled }: { disabled: boolean }): JSX.Element {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const push = (): void => {
    setBusy(true);
    setMsg(null);
    void pushDailyTasksSection(date)
      .then((r) => {
        setMsg(r.errors.length ? `Error: ${r.errors[0]}` : `Task section pushed to ${date}.`);
        setBusy(false);
      })
      .catch((e: unknown) => {
        setMsg(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
        setBusy(false);
      });
  };

  return (
    <div style={cardStyle}>
      <span style={labelStyle}>Daily task section</span>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
        Injects a bounded task list into a daily note without touching your other content.
      </span>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={disabled || busy}
          style={{
            padding: "0.35rem 0.6rem", borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
          }}
        />
        {smBtn(push, busy ? "Working…" : "Push section", true, disabled || busy || !date)}
      </div>
      {msg && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{msg}</span>
      )}
    </div>
  );
}

// ── Task import panel ─────────────────────────────────────────────────────────

function TaskImportPanel({ disabled }: { disabled: boolean }): JSX.Element {
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
      .then((p) => {
        setPreview(p);
        // Pre-select all importable
        setSelected(new Set(p.importable.map((_, i) => i)));
        setScanning(false);
      })
      .catch((e: unknown) => {
        setMsg(`Scan failed: ${e instanceof Error ? e.message : "unknown"}`);
        setScanning(false);
      });
  };

  const toggleAll = (): void => {
    if (!preview) return;
    if (selected.size === preview.importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(preview.importable.map((_, i) => i)));
    }
  };

  const doImport = (): void => {
    if (!preview) return;
    const toImport = preview.importable.filter((_, i) => selected.has(i));
    if (!toImport.length) return;
    setImporting(true);
    setMsg(null);
    void confirmTaskImport(toImport)
      .then((r) => {
        setMsg(`Imported ${r.imported} tasks.${r.errors.length ? ` Errors: ${r.errors.slice(0, 2).join("; ")}` : ""}`);
        setPreview(null);
        setSelected(new Set());
        setImporting(false);
      })
      .catch((e: unknown) => {
        setMsg(`Import failed: ${e instanceof Error ? e.message : "unknown"}`);
        setImporting(false);
      });
  };

  const busy = scanning || importing || disabled;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <span style={labelStyle}>Import tasks from vault</span>
        {smBtn(scan, scanning ? "Scanning…" : "Scan", false, busy)}
      </div>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
        Finds task lines in your vault task files that are not yet in DopaFlow. Review before importing.
      </span>

      {preview && (
        <>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            {preview.total_scanned} scanned · {preview.importable.length} importable · {preview.known.length} already known · {preview.skipped} skipped
          </div>

          {preview.importable.length > 0 ? (
            <div style={{ display: "grid", gap: "0.3rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "var(--text-xs)", cursor: "pointer" }}>
                  <input type="checkbox" checked={selected.size === preview.importable.length} onChange={toggleAll} />
                  Select all
                </label>
                <span style={{ marginLeft: "auto" }}>
                  {smBtn(doImport, importing ? "Importing…" : `Import ${selected.size}`, true, importing || selected.size === 0)}
                </span>
              </div>
              <div style={{ maxHeight: "14rem", overflowY: "auto", display: "grid", gap: "0.2rem" }}>
                {preview.importable.map((c, i) => (
                  <label
                    key={i}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "0.5rem",
                      padding: "0.3rem 0.4rem", borderRadius: "6px",
                      background: selected.has(i) ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                      cursor: "pointer", fontSize: "var(--text-xs)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        setSelected(next);
                      }}
                      style={{ marginTop: "0.1rem", flexShrink: 0 }}
                    />
                    <div>
                      <span style={{ fontWeight: 600 }}>{c.title}</span>
                      {c.due_str && <span style={{ color: "var(--text-secondary)", marginLeft: "0.4rem" }}>📅 {c.due_str}</span>}
                      {c.tags.length > 0 && <span style={{ color: "var(--text-secondary)", marginLeft: "0.4rem" }}>{c.tags.map(t => `#${t}`).join(" ")}</span>}
                      {c.project_name && <span style={{ color: "var(--text-secondary)", marginLeft: "0.4rem" }}>· {c.project_name}</span>}
                      <span style={{ color: "var(--text-secondary)", marginLeft: "0.4rem", fontFamily: "monospace" }}>{c.file_path}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>No new importable tasks found.</span>
          )}
        </>
      )}

      {msg && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{msg}</span>
      )}
    </div>
  );
}

// ── Conflict list ─────────────────────────────────────────────────────────────

function ConflictList({
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
  if (!conflicts.length) return null;

  const directionLabel: Record<string, string> = {
    push: "last pushed",
    pull: "last pulled",
  };

  return (
    <div style={{ ...cardStyle, borderColor: "color-mix(in srgb, var(--color-warn, #f87171) 40%, var(--border-subtle))" }}>
      <span style={{ ...labelStyle, color: "var(--color-warn, #f87171)" }}>
        {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} — both sides changed
      </span>
      {conflicts.map((c) => (
        <div
          key={c.id}
          style={{
            padding: "0.5rem 0.6rem", borderRadius: "10px",
            background: "var(--surface)", border: "1px solid var(--border-subtle)",
            display: "grid", gap: "0.3rem",
          }}
        >
          <code style={{ fontSize: "var(--text-xs)", wordBreak: "break-all" }}>{c.file_path}</code>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              {c.entity_type} · {c.entity_id}
            </span>
            {c.last_direction && (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                {directionLabel[c.last_direction] ?? c.last_direction}
                {c.last_synced_at ? ` ${c.last_synced_at.slice(0, 16).replace("T", " ")}` : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {smBtn(
              () => onPreview(c.id),
              loadingId === c.id
                ? "Loading preview…"
                : previews[c.id]
                  ? "Hide preview"
                  : "Preview changes",
              false,
              loadingId === c.id,
            )}
            {smBtn(() => onRollback(c.id), "Rollback to DopaFlow")}
            {smBtn(() => onResolve(c.file_path), "Keep vault version")}
          </div>
          {errorById[c.id] && (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-warn, #f87171)" }}>
              {errorById[c.id]}
            </span>
          )}
          {previews[c.id] && (
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
                  {(previews[c.id]?.diff_lines.length ?? 0) > 0
                    ? previews[c.id]?.diff_lines.map((line, index) => (
                        <div key={`${c.id}-diff-${index}`} style={diffLineStyle(line)}>{line}</div>
                      ))
                    : <div style={{ color: "var(--text-secondary)" }}>No textual diff available.</div>}
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
                    {previews[c.id]?.current_exists
                      ? previewText(previews[c.id]?.current_body ?? null)
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
                    {previewText(previews[c.id]?.snapshot_body ?? null)}
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

// ── Main component ────────────────────────────────────────────────────────────

export function VaultSettings(): JSX.Element {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [conflicts, setConflicts] = useState<VaultFileRecord[]>([]);
  const [conflictPreviews, setConflictPreviews] = useState<Record<number, VaultConflictPreview | undefined>>({});
  const [previewErrorById, setPreviewErrorById] = useState<Record<number, string | undefined>>({});
  const [loadingPreviewId, setLoadingPreviewId] = useState<number | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [enabledInput, setEnabledInput] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = (): void => {
    void getVaultStatus().then((s) => {
      setStatus(s);
      setPathInput(s.config.vault_path);
      setEnabledInput(s.config.vault_enabled);
      setLoading(false);
    });
    void getVaultConflicts().then(setConflicts);
  };

  useEffect(() => { refresh(); }, []);

  const saveConfig = (): void => {
    void updateVaultConfig({ vault_path: pathInput, vault_enabled: enabledInput })
      .then(() => { setLastMessage("Settings saved."); refresh(); })
      .catch((e: unknown) => setLastMessage(`Error: ${e instanceof Error ? e.message : "unknown"}`));
  };

  const run = (
    label: string,
    fn: () => Promise<{ pushed?: number; imported?: number; updated?: number; conflicts: number; errors: string[] }>,
  ): void => {
    setSyncState("working");
    setLastMessage(null);
    void fn()
      .then((r) => {
        setSyncState("done");
        const count = (r as { pushed?: number }).pushed ?? (((r as { imported?: number }).imported ?? 0) + ((r as { updated?: number }).updated ?? 0));
        let msg = `${label}: ${count} synced`;
        if (r.conflicts) msg += ` · ${r.conflicts} conflicts`;
        if (r.errors.length) msg += `\n${r.errors.slice(0, 3).join("; ")}`;
        setLastMessage(msg);
        refresh();
      })
      .catch((e: unknown) => {
        setSyncState("error");
        setLastMessage(`${label} failed: ${e instanceof Error ? e.message : "unknown"}`);
      });
  };

  const doRollback = (id: number): void => {
    void rollbackVaultFile(id)
      .then((r) => { setLastMessage(r.message); refresh(); })
      .catch((e: unknown) => setLastMessage(`Rollback failed: ${e instanceof Error ? e.message : "unknown"}`));
  };

  const doResolve = (filePath: string): void => {
    void resolveVaultConflict(filePath)
      .then(() => { setLastMessage("Conflict resolved."); refresh(); })
      .catch((e: unknown) => setLastMessage(`Resolve failed: ${e instanceof Error ? e.message : "unknown"}`));
  };

  const togglePreview = (recordId: number): void => {
    if (conflictPreviews[recordId]) {
      setConflictPreviews((current) => ({ ...current, [recordId]: undefined }));
      setPreviewErrorById((current) => ({ ...current, [recordId]: undefined }));
      return;
    }

    setLoadingPreviewId(recordId);
    setPreviewErrorById((current) => ({ ...current, [recordId]: undefined }));
    void getVaultConflictPreview(recordId)
      .then((preview) => {
        setConflictPreviews((current) => ({ ...current, [recordId]: preview }));
      })
      .catch((e: unknown) => {
        setPreviewErrorById((current) => ({
          ...current,
          [recordId]: e instanceof Error ? e.message : "Preview failed",
        }));
      })
      .finally(() => setLoadingPreviewId((current) => (current === recordId ? null : current)));
  };

  const busy = syncState === "working";
  const active = status?.vault_reachable && status?.config.vault_enabled;

  if (loading) {
    return <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Loading vault settings…</div>;
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <StatusDot ok={status?.vault_reachable ?? false} />
        <strong style={{ fontSize: "var(--text-base)" }}>Obsidian Vault</strong>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginLeft: "auto" }}>
          {status?.total_indexed ?? 0} indexed · {status?.conflicts ?? 0} conflicts
        </span>
      </div>

      {/* Config card */}
      <div style={cardStyle}>
        <label style={labelStyle}>Vault folder path</label>
        <input
          style={{
            width: "100%", padding: "0.45rem 0.7rem", borderRadius: "8px",
            border: "1px solid var(--border)", background: "var(--surface)",
            color: "var(--text-primary)", fontSize: "var(--text-sm)", fontFamily: "monospace",
          }}
          type="text"
          value={pathInput}
          placeholder="/Users/you/Documents/MyVault"
          onChange={(e) => setPathInput(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={enabledInput}
              onChange={(e) => setEnabledInput(e.target.checked)}
            />
            Enable bridge
          </label>
          <button
            style={{
              padding: "0.4rem 0.9rem", borderRadius: "8px", border: "none",
              background: "var(--accent)", color: "var(--text-inverted)",
              cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600,
            }}
            onClick={saveConfig}
          >
            Save
          </button>
        </div>
      </div>

      {/* Coverage summary */}
      {active && (
        <div style={{ ...cardStyle, gap: "0.35rem" }}>
          <span style={{ ...labelStyle, marginBottom: "0.2rem" }}>What syncs</span>
          {[
            ["Journal", `${status?.config.daily_note_folder ?? "Daily"}/*.md — one note per day`],
            ["Tasks", `${status?.config.tasks_folder ?? "Tasks"}/*.md — one file per project + Inbox`],
          ].map(([name, desc]) => (
            <div key={name} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, minWidth: "10ch" }}>{name}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Manual sync rows */}
      {active && (
        <div style={cardStyle}>
          <span style={labelStyle}>Manual sync</span>
          <SyncRow
            label="Journal"
            description="Push daily notes · pull vault edits back"
            onPush={() => run("Journal push", pushJournal)}
            onPull={() => run("Journal pull", pullJournal)}
            disabled={busy}
          />
          <SyncRow
            label="Tasks"
            description="Push task lists · pull checkbox changes back"
            onPush={() => run("Tasks push", pushTasks)}
            onPull={() => run("Tasks pull", pullTasks)}
            disabled={busy}
          />
        </div>
      )}

      {/* Daily task section */}
      {active && <DailyTaskSection disabled={busy} />}

      {/* Task import */}
      {active && <TaskImportPanel disabled={busy} />}

      {/* Status message */}
      {lastMessage && (
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: syncState === "error" ? "var(--color-warn, #f87171)" : "var(--text-secondary)",
            whiteSpace: "pre-line",
          }}
        >
          {lastMessage}
        </span>
      )}

      {/* Conflicts */}
      <ConflictList
        conflicts={conflicts}
        previews={conflictPreviews}
        loadingId={loadingPreviewId}
        errorById={previewErrorById}
        onPreview={togglePreview}
        onRollback={doRollback}
        onResolve={doResolve}
      />
    </div>
  );
}

export default VaultSettings;
