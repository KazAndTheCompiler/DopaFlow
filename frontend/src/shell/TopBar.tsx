import { useEffect, useState } from "react";

import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useUpdateBanner } from "../hooks/useUpdateBanner";
import { TopBarChannelBanner, TopBarReleaseBanner } from "./TopBarBanners";
import {
  TopBarActions,
  TopBarBrand,
  TopBarCommandBar,
} from "./TopBarControls";

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
  const [isCompact, setIsCompact] = useState<boolean>(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1080px)").matches
      : false
  ));

  const { listening, transcript, interim, error: sttError, start, stop, supported, reset } = useSpeechRecognition();
  const updateState = useUpdateBanner();
  const buildInfo = updateState.buildInfo;

  // When a final transcript comes in, fill the command input and auto-submit
  useEffect(() => {
    if (transcript) {
      onCommandChange(transcript);
      reset();
    }
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mq = window.matchMedia("(max-width: 1080px)");
    const onChange = (event: MediaQueryListEvent): void => setIsCompact(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const showUpdateBanner = Boolean(buildInfo?.autoUpdateEnabled) && (updateState.available || updateState.downloaded);
  const showChannelBanner = Boolean(buildInfo) && buildInfo?.autoUpdateEnabled !== true;

  return (
    <div style={{ position: "relative", zIndex: 10, minWidth: 0, display: "grid" }}>
      {showUpdateBanner && (
        <TopBarReleaseBanner version={updateState.version} downloaded={updateState.downloaded} />
      )}
      {showChannelBanner && (
        <TopBarChannelBanner version={buildInfo?.version} releaseChannel={buildInfo?.releaseChannel} />
      )}
      <header
        style={{
          minHeight: "var(--topbar-height)",
          display: "grid",
          gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "auto minmax(0, 1fr) auto",
          gap: isCompact ? "0.75rem" : "1rem",
          alignItems: "center",
          padding: isCompact ? "0.65rem 1rem" : "0 1.5rem",
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 86%, transparent), color-mix(in srgb, var(--surface) 96%, transparent))",
          backdropFilter: "var(--topbar-glass-blur, blur(12px))",
          boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
          minWidth: 0,
        }}
      >
        <TopBarBrand isCompact={isCompact} />
        <TopBarCommandBar
          isCompact={isCompact}
          listening={listening}
          interim={interim}
          commandValue={commandValue}
          onCommandChange={onCommandChange}
          showHint={showHint}
          setShowHint={setShowHint}
          supported={supported}
          start={start}
          stop={stop}
          sttError={sttError}
        />
        <TopBarActions
          isCompact={isCompact}
          onCommandSubmit={onCommandSubmit}
          focusModeEnabled={focusModeEnabled}
          onToggleFocusMode={onToggleFocusMode}
          activeTimerLabel={activeTimerLabel}
          onInboxClick={onInboxClick}
          unreadCount={unreadCount}
        />
      </header>
    </div>
  );
}

export default TopBar;
