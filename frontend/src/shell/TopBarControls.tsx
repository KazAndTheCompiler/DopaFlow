import type { Dispatch, SetStateAction } from "react";

import Button from "@ds/primitives/Button";
import Input from "@ds/primitives/Input";
import VoiceButton from "@ds/primitives/VoiceButton";
import { useAppGamification } from "../app/AppContexts";

export function TopBarActions({
  isCompact,
  onCommandSubmit,
  focusModeEnabled,
  onToggleFocusMode,
  activeTimerLabel,
  onInboxClick,
  unreadCount,
}: {
  isCompact: boolean;
  onCommandSubmit: () => void;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  activeTimerLabel?: string | undefined;
  onInboxClick: () => void;
  unreadCount: number;
}): JSX.Element {
  const gamification = useAppGamification();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        flexWrap: "wrap",
        justifyContent: isCompact ? "space-between" : "flex-end",
        minWidth: 0,
      }}
    >
      <Button onClick={onCommandSubmit} style={{ minWidth: isCompact ? "84px" : undefined }}>
        Run
      </Button>
      <Button
        variant="ghost"
        onClick={onToggleFocusMode}
        title={focusModeEnabled ? "Exit focus mode" : "Enter focus mode"}
        style={{ opacity: focusModeEnabled ? 1 : 0.75, borderRadius: "12px" }}
      >
        {focusModeEnabled ? "Focus on" : "Focus off"}
      </Button>
      {activeTimerLabel && (
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--accent)",
            fontWeight: 700,
            padding: "0.45rem 0.8rem",
            borderRadius: "999px",
            background:
              "linear-gradient(135deg, var(--accent)22, color-mix(in srgb, var(--accent) 10%, var(--surface)))",
            border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}
        >
          {isCompact ? activeTimerLabel : `Timer ${activeTimerLabel}`}
        </span>
      )}
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--accent)",
          fontWeight: 700,
          padding: "0.42rem 0.72rem",
          borderRadius: "999px",
          background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
          border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
          whiteSpace: isCompact ? "normal" : "nowrap",
        }}
        title="Progress to next level"
      >
        {`LV ${gamification.level?.level ?? 1} · ${gamification.level?.xp_to_next ?? 100} XP to next`}
      </span>
      <button
        onClick={onInboxClick}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Open notifications"}
        aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"}
        style={{
          position: "relative",
          background:
            unreadCount > 0
              ? "linear-gradient(140deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), color-mix(in srgb, var(--surface) 90%, white 10%))"
              : "transparent",
          color: unreadCount > 0 ? "var(--text-primary)" : "var(--text-secondary)",
          cursor: "pointer",
          padding: "0.45rem 0.7rem",
          borderRadius: "12px",
          lineHeight: 1,
          fontSize: "0.78rem",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-soft)",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          whiteSpace: "nowrap",
        }}
      >
        Inbox
        {unreadCount > 0 && (
          <span
            style={{
              minWidth: "16px",
              height: "16px",
              borderRadius: "999px",
              background: "var(--state-overdue)",
              color: "white",
              fontSize: "0.6rem",
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
              padding: "0 3px",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

export function TopBarBrand({ isCompact }: { isCompact: boolean }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "14px",
          background:
            "linear-gradient(155deg, color-mix(in srgb, var(--accent) 24%, var(--surface)), color-mix(in srgb, var(--surface) 82%, white 18%))",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
          fontWeight: 900,
          boxShadow: "var(--shadow-soft)",
        }}
      >
        D
      </div>
      {!isCompact && (
        <div style={{ display: "grid", gap: "0.1rem" }}>
          <strong style={{ fontSize: "1.05rem", letterSpacing: "0.03em" }}>DopaFlow</strong>
          <span
            style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Daily systems, not dashboard sprawl
          </span>
        </div>
      )}
    </div>
  );
}

export function TopBarCommandBar({
  isCompact,
  listening,
  interim,
  commandValue,
  onCommandChange,
  showHint,
  setShowHint,
  supported,
  start,
  stop,
  sttError,
}: {
  isCompact: boolean;
  listening: boolean;
  interim: string | null;
  commandValue: string;
  onCommandChange: (value: string) => void;
  showHint: boolean;
  setShowHint: Dispatch<SetStateAction<boolean>>;
  supported: boolean;
  start: () => void;
  stop: () => void;
  sttError?: string | null;
}): JSX.Element {
  return (
    <label
      aria-label="Command bar"
      style={{
        display: "grid",
        gap: "0.35rem",
        padding: "0.45rem 0.5rem",
        borderRadius: "18px",
        border: "1px solid var(--border-subtle)",
        background: "color-mix(in srgb, var(--surface) 76%, white 24%)",
        boxShadow: "var(--shadow-soft)",
        minWidth: 0,
        width: "100%",
      }}
    >
      <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
        {!isCompact && (
          <span
            style={{
              padding: "0.32rem 0.58rem",
              borderRadius: "999px",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.68rem",
              color: "var(--text-secondary)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Command
          </span>
        )}
        <Input
          value={listening ? interim || commandValue : commandValue}
          onChange={(event) => onCommandChange(event.currentTarget.value)}
          onFocus={() => setShowHint(true)}
          onBlur={() => setShowHint(false)}
          placeholder={listening ? "Listening…" : "Ask Packy or quick-capture a task, event, or note"}
          style={{ flex: 1 }}
        />
        <VoiceButton
          listening={listening}
          supported={supported}
          onToggle={() => (listening ? stop() : start())}
          size="sm"
          title="Speak a command"
        />
      </div>
      {sttError ? (
        <small style={{ color: "var(--state-error)" }}>{sttError}</small>
      ) : showHint && !isCompact ? (
        <small style={{ color: "var(--text-muted)" }}>
          One entry point for quick capture, command routing, and voice input.
        </small>
      ) : null}
    </label>
  );
}
