import type { AppRoute } from "../appRoutes";
import type { Project } from "../../../shared/types";
import {
  NavButton,
  SidebarHeader,
  SidebarProjectList,
} from "./SidebarSections";
import { SidebarFooter } from "./SidebarFooter";

export interface SidebarItem {
  id: AppRoute;
  label: string;
  icon: string;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeRoute: AppRoute;
  collapsed: boolean;
  habitPips: number;
  streakCount: number;
  momentumScore?: number | undefined;
  projects: Project[];
  projectTaskCounts: Record<string, number>;
  activeProjectId: string | null;
  onProjectSelect: (id: string | null) => void;
  onNavigate: (route: AppRoute) => void;
  onToggle: () => void;
}

export function Sidebar({
  items,
  activeRoute,
  collapsed,
  habitPips,
  streakCount,
  momentumScore,
  projects,
  projectTaskCounts,
  activeProjectId,
  onProjectSelect,
  onNavigate,
  onToggle,
}: SidebarProps): JSX.Element {
  return (
    <aside
      data-testid="sidebar-desktop"
      style={{
        width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-expanded-width)",
        transition: "width 180ms ease",
        borderRight: "1px solid var(--border)",
        background: "var(--sidebar-gradient, var(--surface))",
        backdropFilter: "var(--nav-rail-glass-blur)",
        padding: "1rem 0.5rem",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
      }}
    >
      <SidebarHeader collapsed={collapsed} onToggle={onToggle} />

      <nav data-testid="sidebar-nav" style={{ display: "grid", gap: "0.25rem", flex: 1, overflowY: "auto" }}>
        {items.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            activeRoute={activeRoute}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}

        <SidebarProjectList
          collapsed={collapsed}
          projects={projects}
          projectTaskCounts={projectTaskCounts}
          activeProjectId={activeProjectId}
          onProjectSelect={onProjectSelect}
        />
      </nav>

      <SidebarFooter
        collapsed={collapsed}
        habitPips={habitPips}
        streakCount={streakCount}
        momentumScore={momentumScore}
      />
    </aside>
  );
}

export default Sidebar;
