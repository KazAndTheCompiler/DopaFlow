import type { JSX } from "react";

import type { SyncConflict } from "../../../../shared/types";

import GoogleSyncBadge from "./GoogleSyncBadge";
import PeerSyncBadge from "./PeerSyncBadge";
import SyncConflictModal from "./SyncConflictModal";
import { CalendarTabButton, type CalendarTab } from "./CalendarViewShared";

export function CalendarHeaderPanel({
  tab,
  title,
  calendarRunway,
  summaryChips,
  conflictCount,
  peerFeeds,
  syncStatus,
  showConflicts,
  conflicts,
  onSelectTab,
  onShowConflicts,
  onCloseConflicts,
  onSyncAllPeers,
  onSyncGoogle,
  onResolveConflict,
}: {
  tab: CalendarTab;
  title: string;
  calendarRunway: { eyebrow: string; title: string; body: string };
  summaryChips: string[];
  conflictCount: number;
  peerFeeds: Array<{ id: string; label: string; color: string; sync_status: "idle" | "syncing" | "ok" | "error"; last_synced_at: string | null; last_error: string | null }>;
  syncStatus: string;
  showConflicts: boolean;
  conflicts: SyncConflict[];
  onSelectTab: (tab: CalendarTab) => void;
  onShowConflicts: () => void;
  onCloseConflicts: () => void;
  onSyncAllPeers: () => void;
  onSyncGoogle: () => void;
  onResolveConflict: (id: number, resolution: "prefer_local" | "prefer_incoming") => Promise<void>;
}): JSX.Element {
  return (
    <section
      style={{
        display: "grid",
        gap: "0.9rem",
        padding: "1.1rem 1.2rem 1.2rem",
        borderRadius: "22px",
        border: "1px solid var(--border-subtle)",
        background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 84%, white 16%), var(--surface))",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "grid", gap: "0.45rem", minWidth: 0 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
            Planning surface
          </span>
          <div style={{ display: "grid", gap: "0.15rem" }}>
            <strong style={{ fontSize: "clamp(1.25rem, 2vw, 1.65rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
              {title}
            </strong>
            <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{calendarRunway.body}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
          <CalendarTabButton id="week" label="Week" activeTab={tab} onSelect={onSelectTab} />
          <CalendarTabButton id="day" label="Day" activeTab={tab} onSelect={onSelectTab} />
          <CalendarTabButton id="month" label="Month" activeTab={tab} onSelect={onSelectTab} />
        </div>
      </div>

      <div
        style={{
          padding: "0.85rem 0.95rem",
          borderRadius: "16px",
          background: "color-mix(in srgb, var(--surface) 78%, white 22%)",
          border: "1px solid var(--border-subtle)",
          display: "grid",
          gap: "0.3rem",
        }}
      >
        <span style={{ fontSize: "var(--text-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
          {calendarRunway.eyebrow}
        </span>
        <strong style={{ fontSize: "var(--text-base)" }}>{calendarRunway.title}</strong>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          {summaryChips.map((chip) => (
            <span
              key={chip}
              style={{
                padding: "0.38rem 0.7rem",
                borderRadius: "999px",
                background: "color-mix(in srgb, var(--surface) 74%, white 26%)",
                border: "1px solid var(--border-subtle)",
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
          {conflictCount > 0 && (
            <button
              onClick={onShowConflicts}
              title={`${conflictCount} sync conflict${conflictCount > 1 ? "s" : ""}`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.48rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid var(--state-overdue)",
                background: "color-mix(in srgb, var(--state-overdue) 10%, var(--surface))",
                cursor: "pointer",
                color: "var(--state-overdue)",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
              }}
            >
              Sync conflict{conflictCount > 1 ? "s" : ""}: {conflictCount}
            </button>
          )}
          {peerFeeds.length > 0 && <PeerSyncBadge feeds={peerFeeds} onSync={onSyncAllPeers} />}
          <GoogleSyncBadge status={syncStatus} onSync={onSyncGoogle} />
        </div>
        {showConflicts && (
          <SyncConflictModal conflicts={conflicts} onResolve={onResolveConflict} onClose={onCloseConflicts} />
        )}
      </div>
    </section>
  );
}
