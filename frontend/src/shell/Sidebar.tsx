import type { AppRoute } from '../appRoutes';
import { NavButton, SidebarHeader, SidebarProjectList } from './SidebarSections';
import { SidebarFooter } from './SidebarFooter';
import { useAppHabits } from '../app/AppContexts';
import { useAppProjects } from '../app/AppContexts';
import { useAppPacky } from '../app/AppContexts';
import { useAppInsights } from '../app/AppContexts';

export interface SidebarItem {
  id: AppRoute;
  label: string;
  icon: string;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeRoute: AppRoute;
  collapsed: boolean;
  onNavigate: (route: AppRoute) => void;
  onToggle: () => void;
}

export function Sidebar({
  items,
  activeRoute,
  collapsed,
  onNavigate,
  onToggle,
}: SidebarProps): JSX.Element {
  const habits = useAppHabits();
  const projects = useAppProjects();
  const packy = useAppPacky();
  const insights = useAppInsights();

  const habitPips = Math.min(habits.habits.length, 5);
  const streakCount = habits.habits.reduce((sum, habit) => sum + habit.current_streak, 0);
  const momentumScore = packy.momentum?.score ?? insights.momentum?.score;

  return (
    <aside
      data-testid="sidebar-desktop"
      style={{
        width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-expanded-width)',
        transition: 'width 180ms ease',
        borderRight: '1px solid var(--border)',
        background: 'var(--nav-rail-fill, var(--sidebar-gradient, var(--surface)))',
        backdropFilter: 'var(--nav-rail-glass-blur)',
        padding: '1rem 0.5rem',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      <SidebarHeader collapsed={collapsed} onToggle={onToggle} />

      <nav
        data-testid="sidebar-nav"
        style={{ display: 'grid', gap: '0.25rem', flex: 1, overflowY: 'auto' }}
      >
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
          projects={projects.projects}
          projectTaskCounts={projects.taskCounts}
          activeProjectId={projects.activeProjectId}
          onProjectSelect={projects.setActiveProjectId}
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
