import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import type { PlayerLevel } from "../../../shared/types/gamification";
import type { PackyWhisper, Project } from "../../../shared/types";
import Sidebar, { type SidebarItem } from "./Sidebar";
import StatusBar from "./StatusBar";
import TopBar from "./TopBar";

export interface ShellProps extends PropsWithChildren {
  route: string;
  navItems: SidebarItem[];
  onNavigate: (route: string) => void;
  unreadCount: number;
  onInboxClick: () => void;
  commandValue: string;
  onCommandChange: (value: string) => void;
  onCommandSubmit: () => void;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  activeTimerLabel?: string | undefined;
  habitPips: number;
  streakCount: number;
  momentumScore?: number | undefined;
  packyWhisper?: PackyWhisper | undefined;
  alarmActive: boolean;
  syncStatus: "idle" | "syncing" | "error";
  skin: string;
  gamificationLevel?: PlayerLevel | undefined;
  projects?: Project[];
  projectTaskCounts?: Record<string, number>;
  activeProjectId?: string | null;
  onProjectSelect?: (id: string | null) => void;
}

export function Shell({
  children,
  route,
  navItems,
  onNavigate,
  unreadCount,
  onInboxClick,
  commandValue,
  onCommandChange,
  onCommandSubmit,
  focusModeEnabled,
  onToggleFocusMode,
  activeTimerLabel,
  habitPips,
  streakCount,
  momentumScore,
  packyWhisper,
  alarmActive,
  syncStatus,
  skin,
  gamificationLevel,
  projects,
  projectTaskCounts,
  activeProjectId,
  onProjectSelect,
}: ShellProps): JSX.Element {
  const isMobile = (): boolean => window.matchMedia("(max-width: 640px)").matches;
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => isMobile());
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => isMobile());
  const [pressedMobileNav, setPressedMobileNav] = useState<string | null>(null);

  const MOBILE_NAV = [
    { id: "today", label: "Today", icon: "TD" },
    { id: "tasks", label: "Tasks", icon: "TS" },
    { id: "focus", label: "Focus", icon: "FC" },
    { id: "habits", label: "Habits", icon: "HB" },
    { id: "journal", label: "Journal", icon: "JR" },
  ] as const;

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skin);
  }, [skin]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e: MediaQueryListEvent): void => {
      setSidebarCollapsed(e.matches);
      setIsMobileLayout(e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobileLayout ? "1fr" : `${sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-expanded-width)"} 1fr`,
        gridTemplateRows: isMobileLayout
          ? "var(--topbar-height) 1fr 56px"
          : "var(--topbar-height) 1fr var(--statusbar-height)",
        background: "var(--bg-gradient, var(--bg-app))",
        transition: "grid-template-columns 200ms ease-in-out",
      }}
    >
      {!isMobileLayout && <div style={{ gridRow: "1 / span 3" }}>
        <Sidebar
          items={navItems}
          activeRoute={route}
          collapsed={sidebarCollapsed}
          habitPips={habitPips}
          streakCount={streakCount}
          momentumScore={momentumScore}
          projects={projects ?? []}
          projectTaskCounts={projectTaskCounts ?? {}}
          activeProjectId={activeProjectId ?? null}
          onProjectSelect={onProjectSelect ?? (() => {})}
          onNavigate={onNavigate}
          onToggle={() => setSidebarCollapsed((value) => !value)}
        />
      </div>}
      <TopBar
        unreadCount={unreadCount}
        onInboxClick={onInboxClick}
        commandValue={commandValue}
        onCommandChange={onCommandChange}
        onCommandSubmit={onCommandSubmit}
        focusModeEnabled={focusModeEnabled}
        onToggleFocusMode={onToggleFocusMode}
        activeTimerLabel={activeTimerLabel}
      />
      <main style={{ padding: sidebarCollapsed ? "1rem" : "1.5rem", overflow: "auto" }}>
        <div key={route} className="surface-fade">{children}</div>
      </main>
      {isMobileLayout ? (
        <nav
          style={{
            display: "flex",
            alignItems: "stretch",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, white 4%), var(--surface))",
            borderTop: "1px solid var(--border)",
            paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -10px 24px rgba(0,0,0,0.08)",
          }}
        >
          {MOBILE_NAV.map((item) => {
            const isActive = item.id === route;
            const isPressed = pressedMobileNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                onTouchStart={() => setPressedMobileNav(item.id)}
                onTouchEnd={() => setPressedMobileNav((current) => current === item.id ? null : current)}
                onTouchCancel={() => setPressedMobileNav((current) => current === item.id ? null : current)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.18rem",
                  border: "none",
                  background: "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer",
                  padding: "0.55rem 0.2rem 0.4rem",
                  fontSize: "0.7rem",
                  minHeight: "44px",
                  transform: isPressed ? "scale(0.92)" : "scale(1)",
                  transition: "transform 100ms ease, color 140ms ease",
                }}
              >
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "10px",
                    display: "grid",
                    placeItems: "center",
                    background: isActive ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "color-mix(in srgb, var(--surface) 74%, white 26%)",
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.icon}
                </span>
                <span style={{ fontSize: "9px", fontWeight: isActive ? 700 : 600 }}>{item.label}</span>
                <span
                  aria-hidden="true"
                  style={{
                    width: isActive ? "14px" : "4px",
                    height: "4px",
                    borderRadius: "999px",
                    background: isActive ? "var(--accent)" : "transparent",
                    transition: "width 160ms ease, background 160ms ease",
                  }}
                />
              </button>
            );
          })}
        </nav>
      ) : (
        <StatusBar whisper={packyWhisper} activeAlarm={alarmActive} syncStatus={syncStatus} gamificationLevel={gamificationLevel} />
      )}
    </div>
  );
}

export default Shell;
