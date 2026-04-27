import React, { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

import SurfaceErrorBoundary from "./components/SurfaceErrorBoundary";
import SurfaceSkeleton from "./components/SurfaceSkeleton";

const TodayView = lazy(() => import("@surfaces/today"));
const TasksView = lazy(() => import("@surfaces/tasks"));
const BoardView = lazy(async () => {
  const module = await import("@surfaces/tasks");
  const BoardSurface = (): JSX.Element => (
    <module.default initialView="board" />
  );
  return { default: BoardSurface };
});
const SearchView = lazy(() => import("@surfaces/search"));
const HabitsView = lazy(() => import("@surfaces/habits"));
const FocusView = lazy(() => import("@surfaces/focus"));
const ReviewView = lazy(() => import("@surfaces/review"));
const JournalView = lazy(() => import("@surfaces/journal"));
const CalendarView = lazy(() => import("@surfaces/calendar"));
const AlarmsView = lazy(() => import("@surfaces/alarms"));
const NutritionView = lazy(() => import("@surfaces/nutrition"));
const DigestView = lazy(() => import("@surfaces/digest"));
const PlayerView = lazy(() => import("@surfaces/player"));
const OverviewView = lazy(() => import("@surfaces/overview"));
const GamificationView = lazy(() => import("@surfaces/gamification"));
const InsightsView = lazy(() => import("@surfaces/insights"));
const GoalsView = lazy(() => import("@surfaces/goals"));
const CommandsView = lazy(() => import("@surfaces/commands"));
const SettingsView = lazy(() => import("@surfaces/settings"));
const AuthCallbackView = lazy(() => import("@surfaces/auth-callback"));

function wrapSurface(
  Surface: LazyExoticComponent<ComponentType>,
): ComponentType {
  return function WrappedSurface(): JSX.Element {
    return (
      <SurfaceErrorBoundary>
        <React.Suspense fallback={<SurfaceSkeleton />}>
          <Surface />
        </React.Suspense>
      </SurfaceErrorBoundary>
    );
  };
}

const TodaySurface = wrapSurface(TodayView);
const TasksSurface = wrapSurface(TasksView);
const BoardSurface = wrapSurface(BoardView);
const SearchSurface = wrapSurface(SearchView);
const HabitsSurface = wrapSurface(HabitsView);
const FocusSurface = wrapSurface(FocusView);
const ReviewSurface = wrapSurface(ReviewView);
const JournalSurface = wrapSurface(JournalView);
const CalendarSurface = wrapSurface(CalendarView);
const AlarmsSurface = wrapSurface(AlarmsView);
const NutritionSurface = wrapSurface(NutritionView);
const DigestSurface = wrapSurface(DigestView);
const PlayerSurface = wrapSurface(PlayerView);
const OverviewSurface = wrapSurface(OverviewView);
const GamificationSurface = wrapSurface(GamificationView);
const InsightsSurface = wrapSurface(InsightsView);
const GoalsSurface = wrapSurface(GoalsView);
const CommandsSurface = wrapSurface(CommandsView);
const SettingsSurface = wrapSurface(SettingsView);
const AuthCallbackSurface = wrapSurface(AuthCallbackView);

export type RouteIntentAction =
  | "open-task-create"
  | "open-tasks"
  | "open-habits"
  | "start-focus"
  | "open-review"
  | "open-journal"
  | "open-calendar"
  | "open-today"
  | "open-search"
  | "open-command-bar"
  | "open-nutrition"
  | "open-overview"
  | "open-insights"
  | "open-player"
  | "open-gamification"
  | "open-digest"
  | "open-alarms";

export type CommandIntent =
  | "task.create"
  | "task.complete"
  | "task.list"
  | "journal.create"
  | "calendar.create"
  | "focus.start"
  | "alarm.create"
  | "habit.checkin"
  | "habit.list"
  | "review.start"
  | "search"
  | "nutrition.log"
  | "undo";

export const APP_ROUTE_IDS = [
  "plan",
  "today",
  "tasks",
  "board",
  "search",
  "habits",
  "focus",
  "review",
  "journal",
  "calendar",
  "alarms",
  "nutrition",
  "digest",
  "player",
  "overview",
  "gamification",
  "insights",
  "goals",
  "commands",
  "shutdown",
  "settings",
  "auth-callback",
] as const;

export type AppRoute = (typeof APP_ROUTE_IDS)[number];

export interface AppRouteMeta {
  id: AppRoute;
  label: string;
  icon: string;
  showInSidebar?: boolean;
  showInMobileNav?: boolean;
  surface: ComponentType;
}

export const routeRegistry = [
  {
    id: "plan",
    label: "Plan day",
    icon: "PD",
    surface: TodaySurface,
    showInSidebar: true,
  },
  {
    id: "today",
    label: "Today",
    icon: "TD",
    surface: TodaySurface,
    showInSidebar: true,
    showInMobileNav: true,
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: "TS",
    surface: TasksSurface,
    showInSidebar: true,
    showInMobileNav: true,
  },
  {
    id: "board",
    label: "Board",
    icon: "BD",
    surface: BoardSurface,
    showInSidebar: true,
  },
  {
    id: "search",
    label: "Search",
    icon: "SR",
    surface: SearchSurface,
    showInSidebar: true,
  },
  {
    id: "habits",
    label: "Habits",
    icon: "HB",
    surface: HabitsSurface,
    showInSidebar: true,
    showInMobileNav: true,
  },
  {
    id: "focus",
    label: "Focus",
    icon: "FC",
    surface: FocusSurface,
    showInSidebar: true,
    showInMobileNav: true,
  },
  {
    id: "review",
    label: "Review",
    icon: "RV",
    surface: ReviewSurface,
    showInSidebar: true,
  },
  {
    id: "journal",
    label: "Journal",
    icon: "JR",
    surface: JournalSurface,
    showInSidebar: true,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "CL",
    surface: CalendarSurface,
    showInSidebar: true,
  },
  {
    id: "alarms",
    label: "Alarms",
    icon: "AL",
    surface: AlarmsSurface,
    showInSidebar: true,
  },
  {
    id: "nutrition",
    label: "Nutrition",
    icon: "NT",
    surface: NutritionSurface,
    showInSidebar: true,
  },
  {
    id: "digest",
    label: "Digest",
    icon: "DG",
    surface: DigestSurface,
    showInSidebar: true,
  },
  {
    id: "player",
    label: "Player",
    icon: "PL",
    surface: PlayerSurface,
    showInSidebar: true,
  },
  {
    id: "overview",
    label: "Overview",
    icon: "OV",
    surface: OverviewSurface,
    showInSidebar: true,
  },
  {
    id: "gamification",
    label: "Gamify",
    icon: "GM",
    surface: GamificationSurface,
    showInSidebar: true,
  },
  {
    id: "insights",
    label: "Insights",
    icon: "IN",
    surface: InsightsSurface,
    showInSidebar: true,
  },
  {
    id: "goals",
    label: "Goals",
    icon: "GL",
    surface: GoalsSurface,
    showInSidebar: true,
  },
  {
    id: "commands",
    label: "Commands",
    icon: "CM",
    surface: CommandsSurface,
    showInSidebar: true,
  },
  {
    id: "shutdown",
    label: "Shutdown",
    icon: "SD",
    surface: TodaySurface,
    showInSidebar: true,
  },
  {
    id: "settings",
    label: "Settings",
    icon: "ST",
    surface: SettingsSurface,
    showInSidebar: true,
  },
  {
    id: "auth-callback",
    label: "Auth callback",
    icon: "AU",
    surface: AuthCallbackSurface,
  },
] as const satisfies readonly AppRouteMeta[];

const routeIds = new Set<AppRoute>(routeRegistry.map((route) => route.id));

export function isAppRoute(value: string): value is AppRoute {
  return routeIds.has(value as AppRoute);
}

export function getRouteFromHash(
  hash: string = window.location.hash,
): AppRoute {
  const route = hash.replace(/^#\//, "");
  return isAppRoute(route) ? route : "today";
}

export function routeToHash(route: AppRoute): string {
  return `#/${route}`;
}

export const sidebarRoutes = routeRegistry.filter(
  (route) => "showInSidebar" in route && route.showInSidebar,
);
export const mobileNavRoutes = routeRegistry.filter(
  (route) => "showInMobileNav" in route && route.showInMobileNav,
);

export const actionRoutes: Record<RouteIntentAction, AppRoute> = {
  "open-task-create": "tasks",
  "open-tasks": "tasks",
  "open-habits": "habits",
  "start-focus": "focus",
  "open-review": "review",
  "open-journal": "journal",
  "open-calendar": "calendar",
  "open-today": "today",
  "open-search": "search",
  "open-command-bar": "today",
  "open-nutrition": "nutrition",
  "open-overview": "overview",
  "open-insights": "insights",
  "open-player": "player",
  "open-gamification": "gamification",
  "open-digest": "digest",
  "open-alarms": "alarms",
};

export const intentRoutes: Record<CommandIntent, AppRoute> = {
  "task.create": "tasks",
  "task.complete": "tasks",
  "task.list": "tasks",
  "journal.create": "journal",
  "calendar.create": "calendar",
  "focus.start": "focus",
  "alarm.create": "alarms",
  "habit.checkin": "habits",
  "habit.list": "habits",
  "review.start": "review",
  search: "search",
  "nutrition.log": "nutrition",
  undo: "tasks",
};

export function getRouteComponent(route: AppRoute): ComponentType {
  return (
    routeRegistry.find((entry) => entry.id === route)?.surface ?? TodaySurface
  );
}
