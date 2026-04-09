import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

const TodayView = lazy(() => import("@surfaces/today"));
const TasksView = lazy(() => import("@surfaces/tasks"));
const BoardView = lazy(async () => {
  const module = await import("@surfaces/tasks");
  const BoardSurface = (): JSX.Element => <module.default initialView="board" />;
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

export type RouteIntentAction =
  | "open-task-create"
  | "open-habits"
  | "start-focus"
  | "open-review"
  | "open-journal"
  | "open-today"
  | "open-search"
  | "open-command-bar"
  | "open-nutrition"
  | "open-overview"
  | "open-insights"
  | "open-player"
  | "open-gamification"
  | "open-digest";

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
] as const;

export type AppRoute = (typeof APP_ROUTE_IDS)[number];

export interface AppRouteMeta {
  id: AppRoute;
  label: string;
  icon: string;
  showInSidebar?: boolean;
  showInMobileNav?: boolean;
  surface: LazyExoticComponent<ComponentType>;
}

export const routeRegistry = [
  { id: "plan", label: "Plan day", icon: "PD", surface: TodayView, showInSidebar: true },
  { id: "today", label: "Today", icon: "TD", surface: TodayView, showInSidebar: true, showInMobileNav: true },
  { id: "tasks", label: "Tasks", icon: "TS", surface: TasksView, showInSidebar: true, showInMobileNav: true },
  { id: "board", label: "Board", icon: "BD", surface: BoardView, showInSidebar: true },
  { id: "search", label: "Search", icon: "SR", surface: SearchView, showInSidebar: true },
  { id: "habits", label: "Habits", icon: "HB", surface: HabitsView, showInSidebar: true, showInMobileNav: true },
  { id: "focus", label: "Focus", icon: "FC", surface: FocusView, showInSidebar: true, showInMobileNav: true },
  { id: "review", label: "Review", icon: "RV", surface: ReviewView, showInSidebar: true },
  { id: "journal", label: "Journal", icon: "JR", surface: JournalView, showInSidebar: true },
  { id: "calendar", label: "Calendar", icon: "CL", surface: CalendarView, showInSidebar: true },
  { id: "alarms", label: "Alarms", icon: "AL", surface: AlarmsView, showInSidebar: true },
  { id: "nutrition", label: "Nutrition", icon: "NT", surface: NutritionView, showInSidebar: true },
  { id: "digest", label: "Digest", icon: "DG", surface: DigestView, showInSidebar: true },
  { id: "player", label: "Player", icon: "PL", surface: PlayerView, showInSidebar: true },
  { id: "overview", label: "Overview", icon: "OV", surface: OverviewView, showInSidebar: true },
  { id: "gamification", label: "Gamify", icon: "GM", surface: GamificationView, showInSidebar: true },
  { id: "insights", label: "Insights", icon: "IN", surface: InsightsView, showInSidebar: true },
  { id: "goals", label: "Goals", icon: "GL", surface: GoalsView, showInSidebar: true },
  { id: "commands", label: "Commands", icon: "CM", surface: CommandsView, showInSidebar: true },
  { id: "shutdown", label: "Shutdown", icon: "SD", surface: TodayView, showInSidebar: true },
  { id: "settings", label: "Settings", icon: "ST", surface: SettingsView, showInSidebar: true },
] as const satisfies readonly AppRouteMeta[];

const routeIds = new Set<AppRoute>(routeRegistry.map((route) => route.id));

export function isAppRoute(value: string): value is AppRoute {
  return routeIds.has(value as AppRoute);
}

export function getRouteFromHash(hash: string = window.location.hash): AppRoute {
  const route = hash.replace(/^#\//, "");
  return isAppRoute(route) ? route : "today";
}

export function routeToHash(route: AppRoute): string {
  return `#/${route}`;
}

export const sidebarRoutes = routeRegistry.filter((route) => "showInSidebar" in route && route.showInSidebar);
export const mobileNavRoutes = routeRegistry.filter((route) => "showInMobileNav" in route && route.showInMobileNav);

export const actionRoutes: Record<RouteIntentAction, AppRoute> = {
  "open-task-create": "tasks",
  "open-habits": "habits",
  "start-focus": "focus",
  "open-review": "review",
  "open-journal": "journal",
  "open-today": "today",
  "open-search": "tasks",
  "open-command-bar": "today",
  "open-nutrition": "nutrition",
  "open-overview": "overview",
  "open-insights": "insights",
  "open-player": "player",
  "open-gamification": "gamification",
  "open-digest": "digest",
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
  search: "tasks",
  "nutrition.log": "nutrition",
  undo: "tasks",
};

export function getRouteComponent(route: AppRoute): LazyExoticComponent<ComponentType> {
  return routeRegistry.find((entry) => entry.id === route)?.surface ?? TodayView;
}
