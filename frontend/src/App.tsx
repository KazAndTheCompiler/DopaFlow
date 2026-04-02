import { Component, createContext, lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { ToastContainer } from "@ds/primitives/Toast";
import NotificationInbox from "./components/NotificationInbox";
import AchievementToast from "./components/gamification/AchievementToast";
import CommandPalette from "./components/CommandPalette";
import Shell from "./shell/Shell";
import { useAlarms } from "./hooks/useAlarms";
import { useCalendar } from "./hooks/useCalendar";
import { useCommandBar } from "./hooks/useCommandBar";
import { useFocus } from "./hooks/useFocus";
import { useHabits } from "./hooks/useHabits";
import { useGamification } from "./hooks/useGamification";
import { useInsights } from "./hooks/useInsights";
import { useJournal } from "./hooks/useJournal";
import { useNotifications } from "./hooks/useNotifications";
import { usePacky } from "./hooks/usePacky";
import { useReview } from "./hooks/useReview";
import { useSkin } from "./hooks/useSkin";
import { useTasks } from "./hooks/useTasks";
import { useProjects } from "./hooks/useProjects";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { materializeRecurringTasks } from "./api/tasks";

const TodayView = lazy(() => import("@surfaces/today"));
const TasksView = lazy(() => import("@surfaces/tasks"));
const SearchView = lazy(() => import("@surfaces/search"));
const HabitsView = lazy(() => import("@surfaces/habits"));
const FocusView = lazy(() => import("@surfaces/focus"));
const ReviewView = lazy(() => import("@surfaces/review"));
const JournalView = lazy(() => import("@surfaces/journal"));
const CalendarView = lazy(() => import("@surfaces/calendar"));
const AlarmsView = lazy(() => import("@surfaces/alarms"));
const SettingsView = lazy(() => import("@surfaces/settings"));
const DigestView = lazy(() => import("@surfaces/digest"));
const CommandsView = lazy(() => import("@surfaces/commands"));
const NutritionView = lazy(() => import("@surfaces/nutrition"));
const OverviewView = lazy(() => import("@surfaces/overview"));
const InsightsView = lazy(() => import("@surfaces/insights"));
const GamificationView = lazy(() => import("@surfaces/gamification"));
const PlayerView = lazy(() => import("@surfaces/player"));
const GoalsView = lazy(() => import("@surfaces/goals"));
import PlanMyDayModal from "./surfaces/plan/PlanMyDayModal";
import ShutdownModal from "./surfaces/shutdown/ShutdownModal";
import OnboardingModal from "./surfaces/onboarding/OnboardingModal";

export interface AppContextValue {
  tasks: ReturnType<typeof useTasks>;
  projects: ReturnType<typeof useProjects>;
  habits: ReturnType<typeof useHabits>;
  focus: ReturnType<typeof useFocus>;
  review: ReturnType<typeof useReview>;
  journal: ReturnType<typeof useJournal>;
  calendar: ReturnType<typeof useCalendar>;
  alarms: ReturnType<typeof useAlarms>;
  packy: ReturnType<typeof usePacky>;
  insights: ReturnType<typeof useInsights>;
  notifications: ReturnType<typeof useNotifications>;
  skin: ReturnType<typeof useSkin>;
  gamification: ReturnType<typeof useGamification>;
}

export const AppDataContext = createContext<AppContextValue | null>(null);

const NAV_ITEMS = [
  { id: "plan", label: "Plan day", icon: "PD" },
  { id: "today", label: "Today", icon: "TD" },
  { id: "tasks", label: "Tasks", icon: "TS" },
  { id: "board", label: "Board", icon: "BD" },
  { id: "search", label: "Search", icon: "SR" },
  { id: "habits", label: "Habits", icon: "HB" },
  { id: "focus", label: "Focus", icon: "FC" },
  { id: "review", label: "Review", icon: "RV" },
  { id: "journal", label: "Journal", icon: "JR" },
  { id: "calendar", label: "Calendar", icon: "CL" },
  { id: "alarms", label: "Alarms", icon: "AL" },
  { id: "nutrition", label: "Nutrition", icon: "NT" },
  { id: "digest", label: "Digest", icon: "DG" },
  { id: "player", label: "Player", icon: "PL" },
  { id: "overview", label: "Overview", icon: "OV" },
  { id: "gamification", label: "Gamify", icon: "GM" },
  { id: "insights", label: "Insights", icon: "IN" },
  { id: "goals", label: "Goals", icon: "GL" },
  { id: "commands", label: "Commands", icon: "CM" },
  { id: "shutdown", label: "Shutdown", icon: "SD" },
  { id: "settings", label: "Settings", icon: "ST" },
] as const;

const ACTION_ROUTES: Record<string, string> = {
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

function getRouteFromHash(): string {
  const route = window.location.hash.replace(/^#\//, "");
  return route || "today";
}

class SurfaceErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    /** Hook point for surface-level error reporting. */
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <div>Surface failed to render.</div>;
    }

    return this.props.children;
  }
}

export default function App(): JSX.Element {
  const tasks = useTasks();
  const projects = useProjects();
  const habits = useHabits();
  const focus = useFocus();
  const review = useReview();
  const journal = useJournal();
  const calendar = useCalendar();
  const alarms = useAlarms();
  const packy = usePacky();
  const handleBadgeEarned = useCallback((badge: { name: string; description: string }) => {
    void packy.updateLorebook(`Achievement: ${badge.name}`, `${badge.description} Earned ${new Date().toLocaleDateString()}.`);
  }, [packy]);
  const gamification = useGamification(handleBadgeEarned);
  const insights = useInsights();
  const notifications = useNotifications();
  const skin = useSkin();
  const commandBar = useCommandBar();

  const [route, setRoute] = useState<string>(getRouteFromHash());
  const [focusModeEnabled, setFocusModeEnabled] = useState<boolean>(false);
  const [inboxOpen, setInboxOpen] = useState<boolean>(false);
  const [planOpen, setPlanOpen] = useState<boolean>(false);
  const [shutdownOpen, setShutdownOpen] = useState<boolean>(false);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => !localStorage.getItem("dopaflow_onboarded"));

  const navigate = useCallback((nextRoute: string): void => {
    if (nextRoute === "plan") {
      setPlanOpen(true);
      return;
    }
    if (nextRoute === "shutdown") {
      setShutdownOpen(true);
      return;
    }
    window.location.hash = `#/${nextRoute}`;
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    const onHashChange = (): void => {
      const nextRoute = getRouteFromHash();
      if (nextRoute === "plan") {
        setPlanOpen(true);
        window.location.hash = `#/${route}`;
        return;
      }
      if (nextRoute === "shutdown") {
        setShutdownOpen(true);
        window.location.hash = `#/${route}`;
        return;
      }
      setRoute(nextRoute);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [route]);

  useEffect(() => {
    void materializeRecurringTasks(168).catch(() => {}); // silent, fire-and-forget
  }, []);

  useKeyboardShortcuts({
    navigate,
    openPlanModal: () => setPlanOpen(true),
  });

  useEffect(() => {
    const TODAY_KEY = "zoestm_planned_date";
    const todayISO = new Date().toISOString().slice(0, 10);
    const lastPlanned = localStorage.getItem(TODAY_KEY);
    if (lastPlanned !== todayISO) {
      // Small delay so the app renders first
      const t = setTimeout(() => setPlanOpen(true), 800);
      return () => clearTimeout(t);
    }
    return;
  }, []);

  useEffect(() => {
    const snapshot = {
      tasksDone: tasks.tasks.filter((task) => task.done).length,
      habitScore: habits.habits.reduce((sum, habit) => sum + habit.current_streak, 0),
      focusDone: focus.sessions.filter((session) => session.status === "completed").length,
      reviewScore: review.cards.reduce((sum, card) => sum + card.reviews_done, 0),
      journalScore: journal.entries.reduce((sum, entry) => sum + entry.version, 0),
    };
    if (snapshot.tasksDone + snapshot.habitScore + snapshot.focusDone + snapshot.reviewScore + snapshot.journalScore > 0) {
      void gamification.refresh();
      const focusMinutes = focus.sessions
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + ((s as { duration_minutes?: number }).duration_minutes ?? 0), 0);
      void packy.updateLorebook(
        "Daily sync",
        `Tasks: ${snapshot.tasksDone}, Streak: ${snapshot.habitScore}, Focus: ${focusMinutes}m`,
        { completed_today: snapshot.tasksDone, habit_streak: snapshot.habitScore, focus_minutes_today: focusMinutes },
      );
    }
  }, [focus.sessions, gamification.refresh, habits.habits, journal.entries, packy, review.cards, tasks.tasks]);

  const contextValue = useMemo<AppContextValue>(
    () => ({
      tasks,
      projects,
      habits,
      focus,
      review,
      journal,
      calendar,
      alarms,
      packy,
      insights,
      notifications,
      skin,
      gamification,
    }),
    [alarms, calendar, focus, gamification, habits, insights, journal, notifications, packy, projects, review, skin, tasks],
  );

  const surface = (() => {
    switch (route) {
      case "tasks":
        return <TasksView />;
      case "board":
        return <TasksView initialView="board" />;
      case "search":
        return <SearchView />;
      case "habits":
        return <HabitsView />;
      case "focus":
        return <FocusView />;
      case "review":
        return <ReviewView />;
      case "journal":
        return <JournalView />;
      case "calendar":
        return <CalendarView />;
      case "alarms":
        return <AlarmsView />;
      case "nutrition":
        return <NutritionView />;
      case "digest":
        return <DigestView />;
      case "player":
        return <PlayerView />;
      case "overview":
        return <OverviewView />;
      case "gamification":
        return <GamificationView />;
      case "insights":
        return <InsightsView />;
      case "goals":
        return <GoalsView />;
      case "commands":
        return <CommandsView />;
      case "settings":
        return <SettingsView />;
      case "today":
      default:
        return <TodayView />;
    }
  })();

  return (
    <AppDataContext.Provider value={contextValue}>
      <Shell
        route={route}
        navItems={[...NAV_ITEMS]}
        onNavigate={navigate}
        unreadCount={notifications.unread}
        onInboxClick={() => setInboxOpen(true)}
        commandValue={commandBar.input}
        onCommandChange={commandBar.setInput}
        onCommandSubmit={() => {
          void commandBar.submit(async (value) => {
            try {
              const result = await packy.ask(value, { route });
              const next = ACTION_ROUTES[result.action];
              if (next && next !== route) {
                setRoute(next);
                window.location.hash = `#/${next}`;
              }
            } finally {
              commandBar.setInput("");
            }
          });
        }}
        focusModeEnabled={focusModeEnabled}
        onToggleFocusMode={() => setFocusModeEnabled((value) => !value)}
        activeTimerLabel={
          focus.activeSession ? `${focus.activeSession.duration_minutes}m ${focus.activeSession.status}` : undefined
        }
        habitPips={Math.min(habits.habits.length, 5)}
        streakCount={habits.habits.reduce((sum, habit) => sum + habit.current_streak, 0)}
        momentumScore={packy.momentum?.score ?? insights.momentum?.score}
        packyWhisper={packy.whisper}
        alarmActive={Boolean(alarms.active_alarm_id)}
        syncStatus="idle"
        skin={skin.skin}
        gamificationLevel={gamification.level}
        projects={projects.projects}
        projectTaskCounts={projects.taskCounts}
        activeProjectId={projects.activeProjectId}
        onProjectSelect={projects.setActiveProjectId}
      >
        <Suspense fallback={<div>Loading surface…</div>}>
          <SurfaceErrorBoundary>{surface}</SurfaceErrorBoundary>
        </Suspense>
      </Shell>
      <NotificationInbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        notifications={notifications.notifications}
        onRead={(id) => void notifications.markRead(id)}
        onReadAll={() => void notifications.markAllRead()}
      />
      <AchievementToast badge={gamification.newBadge} onDismiss={gamification.dismissNewBadge} />
      <ToastContainer />
      {planOpen && (
        <PlanMyDayModal
          onClose={() => setPlanOpen(false)}
          onNavigate={navigate}
        />
      )}
      {shutdownOpen && (
        <ShutdownModal
          completedToday={tasks.tasks.filter((t) => {
            const today = new Date().toISOString().slice(0, 10);
            return t.done && t.updated_at?.slice(0, 10) === today;
          })}
          incompleteToday={tasks.tasks.filter((t) => {
            const today = new Date().toISOString().slice(0, 10);
            return !t.done && t.due_at?.slice(0, 10) === today;
          })}
          tomorrowTasks={tasks.tasks.filter((t) => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowISO = tomorrow.toISOString().slice(0, 10);
            return !t.done && t.due_at?.slice(0, 10) === tomorrowISO;
          })}
          onDefer={async (taskId, when) => {
            if (when === "drop") {
              await tasks.update(taskId, { status: "cancelled" });
            } else if (when === "tomorrow") {
              const tom = new Date();
              tom.setDate(tom.getDate() + 1);
              await tasks.update(taskId, { due_at: tom.toISOString().slice(0, 10) });
            } else if (when === "this_week") {
              const inWeek = new Date();
              inWeek.setDate(inWeek.getDate() + 7);
              await tasks.update(taskId, { due_at: inWeek.toISOString().slice(0, 10) });
            }
          }}
          onJournalNote={async (emoji, note) => {
            const today = new Date().toISOString().slice(0, 10);
            await journal.save({ date: today, markdown_body: note, emoji, tags: ["shutdown"] });
          }}
          onClose={() => setShutdownOpen(false)}
        />
      )}
      <CommandPalette
        projects={projects.projects}
        onProjectSelect={projects.setActiveProjectId}
        onNavigate={(nextRoute) => { window.location.hash = `#/${nextRoute}`; setRoute(nextRoute); }}
        onExecute={async (text) => {
          const result = await packy.ask(text, { route });
          const actionRoutes: Record<string, string> = {
            "open-task-create": "#tasks",
            "open-tasks": "#tasks",
            "open-habits": "#habits",
            "start-focus": "#focus",
            "open-review": "#review",
            "open-journal": "#journal",
            "open-today": "#",
            "open-search": "#tasks",
            "open-nutrition": "#nutrition",
            "open-overview": "#overview",
            "open-insights": "#insights",
            "open-player": "#player",
            "open-gamification": "#gamification",
            "open-digest": "#digest",
            "open-calendar": "#calendar",
            "open-alarms": "#alarms",
          };
          const dest = actionRoutes[result.action];
          if (dest !== undefined) window.location.hash = dest;
        }}
      />
      {onboardingOpen && (
        <OnboardingModal
          onCreateHabits={async (names) => {
            for (const name of names) {
              await habits.create({ name, target_freq: 1, target_period: "day" });
            }
          }}
          onCreateTask={async (text) => {
            await tasks.createStructuredTask({ title: text, priority: 2 });
          }}
          onFinish={() => {
            localStorage.setItem("dopaflow_onboarded", "1");
            setOnboardingOpen(false);
            setRoute("today");
            window.location.hash = "#/today";
          }}
        />
      )}
    </AppDataContext.Provider>
  );
}
