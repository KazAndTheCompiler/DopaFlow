import type { PlayerLevel } from "../../../shared/types/gamification";
import type { PackyWhisper } from "../../../shared/types";
import LevelBadge from "../components/gamification/LevelBadge";
import XPBar from "../components/gamification/XPBar";

export interface StatusBarProps {
  whisper?: PackyWhisper | undefined;
  activeAlarm: boolean;
  syncStatus: "idle" | "syncing" | "error";
  gamificationLevel?: PlayerLevel | undefined;
}

export function StatusBar({ whisper, activeAlarm, syncStatus, gamificationLevel }: StatusBarProps): JSX.Element {
  const syncTone =
    syncStatus === "syncing"
      ? { bg: "var(--accent)18", color: "var(--accent)", label: "Syncing" }
      : syncStatus === "error"
        ? { bg: "var(--state-overdue)18", color: "var(--state-overdue)", label: "Attention" }
        : { bg: "var(--surface-2)", color: "var(--text-secondary)", label: "Idle" };

  return (
    <footer
      style={{
        height: "var(--statusbar-height)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1rem",
        borderTop: "1px solid var(--border)",
        background: "linear-gradient(180deg, var(--surface), color-mix(in srgb, var(--surface) 88%, black 12%))",
        color: "var(--text-muted)",
        fontSize: "var(--text-sm)",
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
        <LevelBadge level={gamificationLevel?.level ?? 1} size="sm" />
        <XPBar totalXp={gamificationLevel?.total_xp ?? 0} level={gamificationLevel?.level ?? 1} progress={gamificationLevel?.progress ?? 0} xpToNext={gamificationLevel?.xp_to_next ?? 100} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{whisper?.text ?? "Packy is quiet for now."}</span>
      </div>
      <span
        style={{
          padding: "0.22rem 0.55rem",
          borderRadius: "999px",
          background: activeAlarm ? "var(--state-warn)18" : "var(--surface-2)",
          color: activeAlarm ? "var(--state-warn)" : "var(--text-secondary)",
          fontWeight: 700,
        }}
      >
        {activeAlarm ? "Alarm armed" : "No alarm"}
      </span>
      <span
        style={{
          padding: "0.22rem 0.55rem",
          borderRadius: "999px",
          background: syncTone.bg,
          color: syncTone.color,
          fontWeight: 700,
        }}
      >
        Sync {syncTone.label}
      </span>
    </footer>
  );
}

export default StatusBar;
