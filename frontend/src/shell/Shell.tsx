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
  gamificationLevel?: PlayerLevel | undefined;
  habitPips: number;
  streakCount: number;
  momentumScore?: number | undefined;
  packyWhisper?: PackyWhisper | undefined;
  alarmActive: boolean;
  syncStatus: "idle" | "syncing" | "error";
  skin: string;
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
  gamificationLevel,
  habitPips,
  streakCount,
  momentumScore,
  packyWhisper,
  alarmActive,
  syncStatus,
  skin,
  projects,
  projectTaskCounts,
  activeProjectId,
  onProjectSelect,
}: ShellProps): JSX.Element {
  const isMobile = (): boolean => window.matchMedia("(max-width: 640px)").matches;
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => isMobile());
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => isMobile());
  const [pressedMobileNav, setPressedMobileNav] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const MOBILE_NAV = [
    { id: "today", label: "Today", icon: "TD" },
    { id: "tasks", label: "Tasks", icon: "TS" },
    { id: "focus", label: "Focus", icon: "FC" },
    { id: "habits", label: "Habits", icon: "HB" },
    { id: "more", label: "More", icon: "••" },
  ] as const;

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skin);
  }, [skin]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e: MediaQueryListEvent): void => {
      setSidebarCollapsed(e.matches);
      setIsMobileLayout(e.matches);
      if (!e.matches) {
        setMobileMenuOpen(false);
      }
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
        gamificationLevel={gamificationLevel}
      />
      <main
        style={{
          padding: isMobileLayout ? "0.9rem 0.85rem 0.75rem" : sidebarCollapsed ? "1rem 1.15rem 1.1rem" : "1.4rem 1.6rem 1.35rem",
          overflow: "auto",
        }}
      >
        <div
          key={route}
          className="surface-fade"
          style={{
            width: "min(100%, 1480px)",
            margin: "0 auto",
          }}
        >
          {children}
        </div>
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
                onClick={() => {
                  if (item.id === "more") {
                    setMobileMenuOpen((value) => !value);
                    return;
                  }
                  setMobileMenuOpen(false);
                  onNavigate(item.id);
                }}
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
                  color: item.id === "more"
                    ? mobileMenuOpen ? "var(--accent)" : "var(--text-muted)"
                    : isActive ? "var(--accent)" : "var(--text-muted)",
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
                    background: item.id === "more"
                      ? mobileMenuOpen
                        ? "color-mix(in srgb, var(--accent) 14%, var(--surface))"
                        : "color-mix(in srgb, var(--surface) 74%, white 26%)"
                      : isActive
                        ? "color-mix(in srgb, var(--accent) 14%, var(--surface))"
                        : "color-mix(in srgb, var(--surface) 74%, white 26%)",
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
                    width: item.id === "more"
                      ? mobileMenuOpen ? "14px" : "4px"
                      : isActive ? "14px" : "4px",
                    height: "4px",
                    borderRadius: "999px",
                    background: item.id === "more"
                      ? mobileMenuOpen ? "var(--accent)" : "transparent"
                      : isActive ? "var(--accent)" : "transparent",
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
      {isMobileLayout && mobileMenuOpen && (
        <>
          <button
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              border: "none",
              background: "rgba(15, 18, 24, 0.34)",
              padding: 0,
              zIndex: 30,
            }}
          />
          <section
            aria-label="Mobile navigation drawer"
            style={{
              position: "fixed",
              left: "0.75rem",
              right: "0.75rem",
              bottom: "4.6rem",
              maxHeight: "min(70vh, 680px)",
              overflowY: "auto",
              padding: "0.9rem",
              borderRadius: "22px",
              background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, white 4%), var(--surface))",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-floating)",
              display: "grid",
              gap: "0.85rem",
              zIndex: 31,
            }}
          >
            <div style={{ display: "grid", gap: "0.18rem" }}>
              <strong style={{ fontSize: "var(--text-base)" }}>Navigate</strong>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                Mobile should fold the shell into a drawer, not hide half the product.
              </span>
            </div>

            <div style={{ display: "grid", gap: "0.45rem" }}>
              {navItems.map((item) => {
                const isActive = item.id === route;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate(item.id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      width: "100%",
                      border: isActive ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--border-subtle)",
                      background: isActive
                        ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                        : "var(--surface-2)",
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      padding: "0.8rem 0.9rem",
                      borderRadius: "14px",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "10px",
                        display: "grid",
                        placeItems: "center",
                        background: isActive ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface)",
                        color: isActive ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </span>
                    <span style={{ flex: 1, fontWeight: isActive ? 700 : 600 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {projects && projects.filter((project) => !project.archived).length > 0 && (
              <div style={{ display: "grid", gap: "0.45rem" }}>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Projects
                </span>
                {projects.filter((project) => !project.archived).map((project) => {
                  const isActive = activeProjectId === project.id;
                  const count = projectTaskCounts?.[project.id] ?? 0;
                  return (
                    <button
                      key={project.id}
                      onClick={() => onProjectSelect?.(isActive ? null : project.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.7rem",
                        width: "100%",
                        border: isActive ? `1px solid ${project.color || "var(--accent)"}` : "1px solid var(--border-subtle)",
                        background: isActive ? "color-mix(in srgb, var(--surface) 78%, white 22%)" : "var(--surface-2)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        padding: "0.75rem 0.85rem",
                        borderRadius: "14px",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "1rem" }}>{project.icon || "PR"}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {project.name}
                      </span>
                      {count > 0 && (
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-secondary)",
                            background: "var(--surface)",
                            borderRadius: "999px",
                            padding: "0.15rem 0.45rem",
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gap: "0.3rem",
                padding: "0.8rem 0.9rem",
                borderRadius: "16px",
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Status
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                {packyWhisper?.text ?? "Packy is quiet for now."}
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Shell;
