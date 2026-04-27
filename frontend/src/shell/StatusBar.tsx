import LevelBadge from "../components/gamification/LevelBadge";
import XPBar from "../components/gamification/XPBar";
import { useAppGamification } from "../app/AppContexts";
import { useAppPacky } from "../app/AppContexts";
import { useAppAlarms } from "../app/AppContexts";

export interface StatusBarProps {
  syncStatus: "idle" | "syncing" | "error";
}

export function StatusBar({ syncStatus }: StatusBarProps): JSX.Element {
  const gamification = useAppGamification();
  const packy = useAppPacky();
  const alarms = useAppAlarms();

  const syncTone =
    syncStatus === "syncing"
      ? { bg: "var(--accent)18", color: "var(--accent)", label: "Syncing" }
      : syncStatus === "error"
        ? {
            bg: "var(--state-overdue)18",
            color: "var(--state-overdue)",
            label: "Attention",
          }
        : {
            bg: "var(--surface-2)",
            color: "var(--text-secondary)",
            label: "Idle",
          };

  return (
    <footer
      style={{
        height: "var(--statusbar-height)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1rem",
        borderTop: "1px solid var(--border)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--surface) 86%, transparent), color-mix(in srgb, var(--surface) 96%, transparent))",
        backdropFilter: "blur(10px)",
        color: "var(--text-muted)",
        fontSize: "var(--text-sm)",
        gap: "1rem",
        position: "relative",
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flex: 1,
          minWidth: 0,
        }}
      >
        <LevelBadge level={gamification.level?.level ?? 1} size="sm" />
        <XPBar
          totalXp={gamification.level?.total_xp ?? 0}
          level={gamification.level?.level ?? 1}
          progress={gamification.level?.progress ?? 0}
          xpToNext={gamification.level?.xp_to_next ?? 100}
        />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {packy.whisper?.text ?? "Packy is quiet for now."}
        </span>
      </div>
      <span
        style={{
          padding: "0.22rem 0.55rem",
          borderRadius: "999px",
          background: alarms.active_alarm_id
            ? "var(--state-warn)18"
            : "var(--surface-2)",
          color: alarms.active_alarm_id
            ? "var(--state-warn)"
            : "var(--text-secondary)",
          fontWeight: 700,
        }}
      >
        {alarms.active_alarm_id ? "Alarm armed" : "No alarm"}
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
