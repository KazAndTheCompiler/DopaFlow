import type { CSSProperties } from "react";

import {
  pullJournal,
  pullTasks,
  pushJournal,
  pushTasks,
} from "@api/index";

import { VaultConflictList } from "./VaultConflictList";
import { VaultDailyTaskSection } from "./VaultDailyTaskSection";
import { cardStyle, labelStyle, StatusDot, SyncRow } from "./VaultSettingsShared";
import { VaultTaskImportPanel } from "./VaultTaskImportPanel";
import { useVaultSettings } from "./useVaultSettings";

const pathInputStyle: CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.7rem",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text-primary)",
  fontSize: "var(--text-sm)",
  fontFamily: "monospace",
};

function VaultCoverageSummary({
  dailyNoteFolder,
  tasksFolder,
}: {
  dailyNoteFolder?: string | null | undefined;
  tasksFolder?: string | null | undefined;
}): JSX.Element {
  return (
    <div style={{ ...cardStyle, gap: "0.35rem" }}>
      <span style={{ ...labelStyle, marginBottom: "0.2rem" }}>What syncs</span>
      {[
        ["Journal", `${dailyNoteFolder ?? "Daily"}/*.md — one note per day`],
        ["Tasks", `${tasksFolder ?? "Tasks"}/*.md — one file per project + Inbox`],
      ].map(([name, description]) => (
        <div key={name} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, minWidth: "10ch" }}>{name}</span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{description}</span>
        </div>
      ))}
    </div>
  );
}

export function VaultSettings(): JSX.Element {
  const {
    status,
    conflicts,
    conflictPreviews,
    previewErrorById,
    loadingPreviewId,
    pathInput,
    enabledInput,
    syncState,
    lastMessage,
    loading,
    busy,
    active,
    setPathInput,
    setEnabledInput,
    saveConfig,
    run,
    doRollback,
    doResolve,
    togglePreview,
  } = useVaultSettings();

  if (loading) {
    return <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Loading vault settings…</div>;
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <StatusDot ok={status?.vault_reachable ?? false} />
        <strong style={{ fontSize: "var(--text-base)" }}>Obsidian Vault</strong>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginLeft: "auto" }}>
          {status?.total_indexed ?? 0} indexed · {status?.conflicts ?? 0} conflicts
        </span>
      </div>

      <div style={cardStyle}>
        <label style={labelStyle}>Vault folder path</label>
        <input
          style={pathInputStyle}
          type="text"
          value={pathInput}
          placeholder="~/Documents/MyVault"
          onChange={(event) => setPathInput(event.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={enabledInput}
              onChange={(event) => setEnabledInput(event.target.checked)}
            />
            Enable bridge
          </label>
          <button
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent)",
              color: "var(--text-inverted)",
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
            }}
            onClick={saveConfig}
          >
            Save
          </button>
        </div>
      </div>

      {active && (
        <VaultCoverageSummary
          dailyNoteFolder={status?.config.daily_note_folder}
          tasksFolder={status?.config.tasks_folder}
        />
      )}

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

      {active && <VaultDailyTaskSection disabled={busy} />}
      {active && <VaultTaskImportPanel disabled={busy} />}

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

      <VaultConflictList
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
