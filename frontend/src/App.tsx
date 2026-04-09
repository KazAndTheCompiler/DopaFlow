import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { showToast } from "@ds/primitives/Toast";
import { AppProviders } from "./app/AppContexts";
import { APP_STORAGE_KEYS } from "./app/appStorage";
import { AppOverlays } from "./app/AppOverlays";
import { SurfaceErrorBoundary, getCommandReply, localDateISO } from "./app/AppShared";
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
import { executeCommandText } from "./api/commands";
import { materializeRecurringTasks } from "./api/tasks";
import type { AppRoute, RouteIntentAction } from "./appRoutes";
import { actionRoutes, getRouteComponent, getRouteFromHash, intentRoutes, isAppRoute, routeToHash, sidebarRoutes } from "./appRoutes";

export { AppDataContext } from "./app/AppContexts";

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

  const [route, setRoute] = useState<AppRoute>(getRouteFromHash());
  const [focusModeEnabled, setFocusModeEnabled] = useState<boolean>(false);
  const [inboxOpen, setInboxOpen] = useState<boolean>(false);
  const [planOpen, setPlanOpen] = useState<boolean>(false);
  const [shutdownOpen, setShutdownOpen] = useState<boolean>(false);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => !localStorage.getItem(APP_STORAGE_KEYS.onboardingComplete));
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
    if (!isAppRoute(nextRoute)) {
      return;
    }
    window.location.hash = routeToHash(nextRoute);
    setRoute(nextRoute);
  }, []);

  const handleCommandExecution = useCallback(async (
    text: string,
    options?: { source?: "text" | "voice"; clearOnHandled?: boolean },
  ): Promise<boolean> => {
    const raw = text.trim();
    if (!raw) {
      return false;
    }

    const source = options?.source ?? "text";

    try {
      const result = await executeCommandText(raw, true, source);
      const intent = typeof result.intent === "string" ? result.intent : "";
      const status = typeof result.status === "string" ? result.status : "";
      const reply = getCommandReply(result);

      const refreshers: Record<string, Array<() => Promise<void>>> = {
        "task.create": [tasks.refresh],
        "task.complete": [tasks.refresh],
        "task.list": [tasks.refresh],
        "journal.create": [journal.refresh],
        "calendar.create": [calendar.refresh],
        "focus.start": [focus.refresh],
        "alarm.create": [alarms.refresh],
        "habit.checkin": [habits.refresh],
        "habit.list": [habits.refresh],
        "review.start": [review.refresh],
        "undo": [tasks.refresh, calendar.refresh],
      };

      if (status === "executed") {
        await Promise.all((refreshers[intent] ?? []).map(async (refresh) => {
          try {
            await refresh();
          } catch {
            // Keep command success visible even if a follow-up refresh fails.
          }
        }));
        void packy.refresh().catch(() => undefined);

        const nextRoute = intentRoutes[intent as keyof typeof intentRoutes];
        if (nextRoute && nextRoute !== route) {
          navigate(nextRoute);
        }

        if (reply) {
          showToast(reply, "success");
        } else {
          showToast("Command completed.", "success");
        }

        if (options?.clearOnHandled !== false) {
          commandBar.setInput("");
        }
        return true;
      }

      if (reply) {
        showToast(reply, status === "error" ? "error" : "info");
      } else if (status === "needs_datetime") {
        showToast("I need a date and time before I can schedule that.", "warn");
      }

      if (status === "greeting" || status === "help" || status === "unknown" || status === "ok") {
        try {
          const packyResult = await packy.ask(raw, { route });
          const nextRoute = actionRoutes[packyResult.action as RouteIntentAction];
          if (nextRoute && nextRoute !== route) {
            navigate(nextRoute);
          }
          if (packyResult.reply && packyResult.reply !== reply) {
            showToast(packyResult.reply, "info");
          }
          if (options?.clearOnHandled !== false) {
            commandBar.setInput("");
          }
          return true;
        } catch (error) {
          console.error("[DopaFlow] Packy fallback failed after command response", error);
        }
      }

      return status !== "error";
    } catch (error) {
      console.error("[DopaFlow] Command execution failed", error);
      showToast("Command failed. The input is still there so you can retry or edit it.", "error");
      return false;
    }
  }, [alarms.refresh, calendar.refresh, commandBar, focus.refresh, habits.refresh, journal.refresh, navigate, packy, review.refresh, route, tasks.refresh]);

  useEffect(() => {
    const onHashChange = (): void => {
      const nextRoute = getRouteFromHash();
      if (nextRoute === "plan") {
        setShutdownOpen(false);
        setPlanOpen(true);
        window.location.hash = routeToHash(route);
        return;
      }
      if (nextRoute === "shutdown") {
        setPlanOpen(false);
        setShutdownOpen(true);
        window.location.hash = routeToHash(route);
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
    const todayISO = localDateISO();
    const lastPlanned = localStorage.getItem(APP_STORAGE_KEYS.plannedDate);
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

  const SurfaceComponent = getRouteComponent(route);

  return (
    <AppProviders
      tasks={tasks}
      projects={projects}
      habits={habits}
      focus={focus}
      review={review}
      journal={journal}
      calendar={calendar}
      alarms={alarms}
      packy={packy}
      insights={insights}
      notifications={notifications}
      skin={skin}
      layout={layout}
      gamification={gamification}
    >
      <Shell
        route={route}
        navItems={[...sidebarRoutes]}
        onNavigate={navigate}
        unreadCount={notifications.unread}
        onInboxClick={() => setInboxOpen(true)}
        commandValue={commandBar.input}
        onCommandChange={commandBar.setInput}
        onCommandSubmit={() => {
          void commandBar.submit(async (value) => {
            await handleCommandExecution(value, { source: "text" });
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
        <SurfaceErrorBoundary route={route}>
          <Suspense fallback={<div style={{ padding: "1rem", color: "var(--text-secondary)" }}>Loading surface…</div>}>
            <SurfaceComponent />
          </Suspense>
        </SurfaceErrorBoundary>
      </Shell>
      <AppOverlays
        inboxOpen={inboxOpen}
        planOpen={planOpen}
        shutdownOpen={shutdownOpen}
        onboardingOpen={onboardingOpen}
        notifications={notifications}
        gamification={gamification}
        projects={projects}
        tasks={tasks}
        journal={journal}
        habits={habits}
        navigate={navigate}
        onCommandExecute={async (text) => {
          await handleCommandExecution(text, { source: "text", clearOnHandled: false });
        }}
        onCloseInbox={() => setInboxOpen(false)}
        onClosePlan={() => setPlanOpen(false)}
        onCloseShutdown={() => setShutdownOpen(false)}
        onFinishOnboarding={() => {
          setRoute("today");
          window.location.hash = routeToHash("today");
        }}
        onSetOnboardingOpen={setOnboardingOpen}
      />
    </AppProviders>
  );
}
