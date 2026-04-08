import { Component, createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { ToastContainer } from "@ds/primitives/Toast";
import { showToast } from "@ds/primitives/Toast";
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
import { useLayout } from "./hooks/useLayout";
import { useTasks } from "./hooks/useTasks";
import { useProjects } from "./hooks/useProjects";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { materializeRecurringTasks } from "./api/tasks";

import TodayView from "@surfaces/today";
import TasksView from "@surfaces/tasks";
import SearchView from "@surfaces/search";
import HabitsView from "@surfaces/habits";
import FocusView from "@surfaces/focus";
import ReviewView from "@surfaces/review";
import JournalView from "@surfaces/journal";
import CalendarView from "@surfaces/calendar";
import AlarmsView from "@surfaces/alarms";
import SettingsView from "@surfaces/settings";
import DigestView from "@surfaces/digest";
import CommandsView from "@surfaces/commands";
import NutritionView from "@surfaces/nutrition";
import OverviewView from "@surfaces/overview";
import InsightsView from "@surfaces/insights";
import GamificationView from "@surfaces/gamification";
import PlayerView from "@surfaces/player";
import GoalsView from "@surfaces/goals";
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
  layout: ReturnType<typeof useLayout>;
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

function localDateISO(offsetDays = 0): string {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
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
  const layout = useLayout();
  const commandBar = useCommandBar();

  const [route, setRoute] = useState<string>(getRouteFromHash());
  const [focusModeEnabled, setFocusModeEnabled] = useState<boolean>(false);
  const [inboxOpen, setInboxOpen] = useState<boolean>(false);
  const [planOpen, setPlanOpen] = useState<boolean>(false);
  const [shutdownOpen, setShutdownOpen] = useState<boolean>(false);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => !localStorage.getItem("dopaflow_onboarded"));
  const [focusNow, setFocusNow] = useState<number>(() => Date.now());
  const lastPackySyncRef = useRef<string>("");
  const lastXpRef = useRef<number | null>(null);
  const lastLevelRef = useRef<number | null>(null);

  const navigate = useCallback((nextRoute: string): void => {
    if (nextRoute === "plan") {
      setShutdownOpen(false);
      setPlanOpen(true);
      return;
    }
    if (nextRoute === "shutdown") {
      setPlanOpen(false);
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
        setShutdownOpen(false);
        setPlanOpen(true);
        window.location.hash = `#/${route}`;
        return;
      }
      if (nextRoute === "shutdown") {
        setPlanOpen(false);
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
    const openShutdown = (): void => {
      setPlanOpen(false);
      setShutdownOpen(true);
    };
    window.addEventListener("dopaflow:open-shutdown", openShutdown as EventListener);
    return () => window.removeEventListener("dopaflow:open-shutdown", openShutdown as EventListener);
  }, []);

  useEffect(() => {
    void materializeRecurringTasks(168).catch(() => {}); // silent, fire-and-forget
  }, []);

  useEffect(() => {
    if (!focus.activeSession || focus.activeSession.status !== "running") {
      return;
    }
    const intervalId = window.setInterval(() => setFocusNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [focus.activeSession?.id, focus.activeSession?.status]);

  const activeTimerLabel = useMemo(() => {
    const session = focus.activeSession;
    if (!session) return undefined;
    const totalSeconds = Math.max(0, Math.round((session.duration_minutes ?? 0) * 60));
    if (!session.started_at) {
      return `${session.duration_minutes}m ${session.status}`;
    }
    const startedAt = new Date(session.started_at).getTime();
    if (Number.isNaN(startedAt)) {
      return `${session.duration_minutes}m ${session.status}`;
    }
    const pausedSeconds = Math.floor((session.paused_duration_ms ?? 0) / 1000);
    const elapsedSeconds = Math.max(0, Math.floor((focusNow - startedAt) / 1000) - pausedSeconds);
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
    const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
    return session.status === "paused"
      ? `${minutes}:${seconds} paused`
      : `${minutes}:${seconds} left`;
  }, [focus.activeSession, focusNow]);

  useKeyboardShortcuts({
    navigate,
    openPlanModal: () => setPlanOpen(true),
  });

  useEffect(() => {
    if (route !== "today") {
      return;
    }
    if (shutdownOpen) {
      return;
    }
    const TODAY_KEY = "zoestm_planned_date";
    const todayISO = localDateISO();
    const lastPlanned = localStorage.getItem(TODAY_KEY);
    if (lastPlanned !== todayISO) {
      // Small delay so the app renders first
      const t = setTimeout(() => setPlanOpen(true), 800);
      return () => clearTimeout(t);
    }
    return;
  }, [route, shutdownOpen]);

  useEffect(() => {
    const snapshot = {
      tasksDone: tasks.tasks.filter((task) => task.done).length,
      habitScore: habits.habits.reduce((sum, habit) => sum + habit.current_streak, 0),
      focusDone: focus.sessions.filter((session) => session.status === "completed").length,
      reviewScore: review.cards.reduce((sum, card) => sum + card.reviews_done, 0),
      journalScore: journal.entries.reduce((sum, entry) => sum + entry.version, 0),
    };
    if (snapshot.tasksDone + snapshot.habitScore + snapshot.focusDone + snapshot.reviewScore + snapshot.journalScore > 0) {
      const syncKey = JSON.stringify(snapshot);
      if (lastPackySyncRef.current === syncKey) {
        return;
      }
      lastPackySyncRef.current = syncKey;
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
  }, [focus.sessions, gamification.refresh, habits.habits, journal.entries, packy.updateLorebook, review.cards, tasks.tasks]);

  useEffect(() => {
    const refreshGamification = (): void => {
      void gamification.refresh();
    };
    window.addEventListener("dopaflow:gamification-refresh", refreshGamification as EventListener);
    return () => window.removeEventListener("dopaflow:gamification-refresh", refreshGamification as EventListener);
  }, [gamification.refresh]);

  useEffect(() => {
    const level = gamification.level;
    if (!level) {
      return;
    }
    if (lastXpRef.current === null) {
      lastXpRef.current = level.total_xp;
      lastLevelRef.current = level.level;
      return;
    }
    const xpDelta = level.total_xp - lastXpRef.current;
    if (xpDelta > 0) {
      showToast(`+${xpDelta} XP · Level ${level.level} · ${level.xp_to_next} to next`, "success");
    }
    if (lastLevelRef.current !== null && level.level > lastLevelRef.current) {
      showToast(`Level up! You reached level ${level.level}.`, "success");
    }
    lastXpRef.current = level.total_xp;
    lastLevelRef.current = level.level;
  }, [gamification.level]);

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
      layout,
      gamification,
    }),
    [alarms, calendar, focus, gamification, habits, insights, journal, layout, notifications, packy, projects, review, skin, tasks],
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
        activeTimerLabel={activeTimerLabel}
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
        <SurfaceErrorBoundary>{surface}</SurfaceErrorBoundary>
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
            const today = localDateISO();
            return t.done && t.updated_at?.slice(0, 10) === today;
          })}
          incompleteToday={tasks.tasks.filter((t) => {
            const today = localDateISO();
            return !t.done && t.due_at?.slice(0, 10) === today;
          })}
          tomorrowTasks={tasks.tasks.filter((t) => {
            const tomorrowISO = localDateISO(1);
            return !t.done && t.due_at?.slice(0, 10) === tomorrowISO;
          })}
          onDefer={async (taskId, when) => {
            if (when === "drop") {
              await tasks.update(taskId, { status: "cancelled" });
            } else if (when === "tomorrow") {
              await tasks.update(taskId, { due_at: localDateISO(1) });
            } else if (when === "this_week") {
              await tasks.update(taskId, { due_at: localDateISO(7) });
            }
          }}
          onJournalNote={async (emoji, note) => {
            const today = localDateISO();
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
            await habits.refresh();
          }}
          onCreateTask={async (text) => {
            await tasks.createStructuredTask({ title: text, priority: 2 });
            await tasks.refresh();
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
