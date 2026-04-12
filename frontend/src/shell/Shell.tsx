import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import type { AppRoute } from "../appRoutes";
import Sidebar, { type SidebarItem } from "./Sidebar";
import { ShellMobileDrawer } from "./ShellMobileDrawer";
import { ShellMobileNav } from "./ShellMobileNav";
import StatusBar from "./StatusBar";
import TopBar from "./TopBar";

export interface ShellProps extends PropsWithChildren {
  route: AppRoute;
  navItems: SidebarItem[];
  onNavigate: (route: AppRoute) => void;
  unreadCount: number;
  onInboxClick: () => void;
  commandValue: string;
  onCommandChange: (value: string) => void;
  onCommandSubmit: () => void;
  focusModeEnabled: boolean;
  onToggleFocusMode: () => void;
  activeTimerLabel?: string | undefined;
  syncStatus: "idle" | "syncing" | "error";
  skin: string;
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
  syncStatus,
  skin,
}: ShellProps): JSX.Element {
  const isMobile = (): boolean => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 640px)").matches
      : false
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => isMobile());
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => isMobile());
  const [pressedMobileNav, setPressedMobileNav] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
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
      data-testid="shell-root"
      data-skin-class={skin}
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobileLayout ? "1fr" : `${sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-expanded-width)"} 1fr`,
        gridTemplateRows: isMobileLayout
          ? "var(--topbar-height) 1fr 56px"
          : "var(--topbar-height) 1fr var(--statusbar-height)",
        background: "var(--bg-gradient, var(--bg-app))",
        transition: "grid-template-columns 200ms ease-in-out",
        position: "relative",
        isolation: "isolate",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--bg-vignette)", pointerEvents: "none", zIndex: -1 }} />
      {!isMobileLayout && <div data-testid="shell-sidebar-zone" style={{ gridRow: "1 / span 3", position: "relative", zIndex: 1, minWidth: 0, minHeight: 0 }}>
        <Sidebar
          items={navItems}
          activeRoute={route}
          collapsed={sidebarCollapsed}
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
      <main
        data-testid="shell-main"
        style={{
          padding: isMobileLayout ? "0.9rem 0.85rem 0.75rem" : sidebarCollapsed ? "1rem 1.15rem 1.1rem" : "1.4rem 1.6rem 1.35rem",
          overflow: "auto",
          position: "relative",
          zIndex: 1,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <div
          data-testid="surface-container"
          key={route}
          className="surface-fade"
          style={{
            width: "min(100%, 1480px)",
            margin: "0 auto",
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          {children}
        </div>
      </main>
      {isMobileLayout ? (
        <ShellMobileNav
          route={route}
          mobileMenuOpen={mobileMenuOpen}
          pressedItemId={pressedMobileNav}
          onNavigate={onNavigate}
          onPressedItemChange={setPressedMobileNav}
          onToggleMenu={() => setMobileMenuOpen((value) => !value)}
          onCloseMenu={() => setMobileMenuOpen(false)}
        />
      ) : (
        <StatusBar syncStatus={syncStatus} />
      )}
      {isMobileLayout && mobileMenuOpen ? (
        <ShellMobileDrawer
          route={route}
          navItems={navItems}
          onNavigate={onNavigate}
          onClose={() => setMobileMenuOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default Shell;
