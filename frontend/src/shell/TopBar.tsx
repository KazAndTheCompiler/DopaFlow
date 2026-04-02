import { useEffect, useState } from "react";

import Button from "@ds/primitives/Button";
import Input from "@ds/primitives/Input";
import VoiceButton from "@ds/primitives/VoiceButton";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useUpdateBanner, installUpdate } from "../hooks/useUpdateBanner";

export interface TopBarProps {
  unreadCount: number;
  onInboxClick: () => void;
  commandValue: string;
  onCommandChange: (value: string) => void;
  onCommandSubmit: () => void;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  activeTimerLabel?: string | undefined;
}

export function TopBar({
  unreadCount,
  onInboxClick,
  commandValue,
  onCommandChange,
  onCommandSubmit,
  focusModeEnabled,
  onToggleFocusMode,
  activeTimerLabel,
}: TopBarProps): JSX.Element {
  const [showHint, setShowHint] = useState<boolean>(false);

  const { listening, transcript, interim, start, stop, supported, reset } = useSpeechRecognition();
  const updateState = useUpdateBanner();
  const buildInfo = updateState.buildInfo;

  // When a final transcript comes in, fill the command input and auto-submit
  useEffect(() => {
    if (transcript) {
      onCommandChange(transcript);
      reset();
    }
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const showUpdateBanner = Boolean(buildInfo?.autoUpdateEnabled) && (updateState.available || updateState.downloaded);
  const showChannelBanner = Boolean(buildInfo) && buildInfo?.autoUpdateEnabled !== true;

  return (
    <>
      {showUpdateBanner && (
        <div
          style={{
            background: updateState.downloaded ? "var(--state-ok)" : "var(--accent)",
            color: "white",
            padding: "0.5rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            fontSize: "var(--text-sm)",
          }}
        >
            <span>
              {updateState.downloaded
                ? `Version ${updateState.version} is ready to install`
                : `Version ${updateState.version} is available`}
            </span>
          {updateState.downloaded ? (
            <button
              onClick={installUpdate}
              style={{
                background: "white",
                color: "var(--state-ok)",
                border: "none",
                borderRadius: "6px",
                padding: "0.25rem 0.75rem",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "var(--text-xs)",
              }}
            >
              Install & Restart
            </button>
          ) : (
            <span style={{ fontSize: "var(--text-xs)", opacity: 0.9 }}>Downloading...</span>
          )}
        </div>
      )}
      {showChannelBanner && (
        <div
          style={{
            background: "color-mix(in srgb, var(--surface) 86%, black 14%)",
            color: "var(--text-primary)",
            padding: "0.5rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            fontSize: "var(--text-sm)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span>
            {buildInfo?.releaseChannel === "dev"
              ? `Dev build ${buildInfo.version}: updates are manual. Paid stable builds use automatic updates from GitHub Releases.`
              : `Build ${buildInfo?.version}: automatic updates are disabled for this channel.`}
          </span>
        </div>
      )}
      <header
      style={{
        height: "var(--topbar-height)",
        display: "grid",
        gridTemplateColumns: "auto minmax(280px, 1fr) auto auto",
        gap: "1rem",
        alignItems: "center",
        padding: "0 1.5rem",
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, white 8%), color-mix(in srgb, var(--surface) 98%, black 2%))",
        boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "14px",
            background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 24%, var(--surface)), color-mix(in srgb, var(--surface) 82%, white 18%))",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            boxShadow: "var(--shadow-soft)",
          }}
        >
          D
        </div>
        <div style={{ display: "grid", gap: "0.1rem" }}>
          <strong style={{ fontSize: "1.05rem", letterSpacing: "0.03em" }}>DopaFlow</strong>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Local-first command center
          </span>
        </div>
      </div>
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
        }}
      >
        <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
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
          <Input
            value={listening ? interim || commandValue : commandValue}
            onChange={(event) => onCommandChange(event.currentTarget.value)}
            onFocus={() => setShowHint(true)}
            onBlur={() => setShowHint(false)}
            placeholder={listening ? "Listening…" : "Tell Packy what you need..."}
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
        {showHint ? <small style={{ color: "var(--text-muted)" }}>Natural language quick actions, quick-add parsing, and voice capture in one place.</small> : null}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Button onClick={onCommandSubmit}>Run</Button>
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
              background: "linear-gradient(135deg, var(--accent)22, color-mix(in srgb, var(--accent) 10%, var(--surface)))",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
          >
            Timer {activeTimerLabel}
          </span>
        )}
        <button
          onClick={onInboxClick}
          title="Notifications"
          style={{
            position: "relative",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "0.45rem",
            borderRadius: "12px",
            lineHeight: 1,
            fontSize: "0.9rem",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-soft)",
            fontWeight: 800,
          }}
        >
          IN
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 0,
                right: 0,
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
    </header>
    </>
  );
}

export default TopBar;
