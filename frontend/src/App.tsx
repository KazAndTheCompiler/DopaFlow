import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { showToast } from "@ds/primitives/Toast";
import { AppProviders } from "./app/AppContexts";
import { APP_STORAGE_KEYS } from "./app/appStorage";
import { AppOverlays } from "./app/AppOverlays";
import { localDateISO } from "./app/AppShared";
import Shell from "./shell/Shell";
import { useOverlayController } from "./app/useOverlayController";
import { useCommandExecutor } from "./app/useCommandExecutor";
import { useFocusTimer, useFocusTimerController } from "./hooks/useFocusTimer";
import { useAppBootstrap } from "./hooks/useAppBootstrap";
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
import { useSSE } from "./hooks/useSSE";
import { routeToHash, getRouteComponent } from "./appRoutes";
import type { AppRoute } from "./appRoutes";
import { getRouteFromHash, isAppRoute, sidebarRoutes } from "./appRoutes";

export { AppDataContext } from "./app/AppContexts";

function BootstrapErrorScreen(): JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--surface) 88%, black 12%), var(--surface))",
      }}
    >
      <div
        style={{
          width: "min(32rem, 100%)",
          padding: "1.5rem",
          borderRadius: "24px",
          background: "var(--surface)",
          border:
            "1px solid color-mix(in srgb, var(--state-overdue) 24%, var(--border-subtle))",
          boxShadow: "var(--shadow-soft)",
          display: "grid",
          gap: "0.9rem",
        }}
      >
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <strong style={{ fontSize: "1.3rem", lineHeight: 1.2 }}>
            Could not connect to DopaFlow backend
          </strong>
          <span style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Check that the backend is running, then retry the app.
          </span>
          <span style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            If you are running DopaFlow locally, make sure the FastAPI server
            started successfully and is reachable from the desktop app.
          </span>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            justifySelf: "start",
            padding: "0.7rem 1rem",
            borderRadius: "10px",
            border: "none",
            background: "var(--accent)",
            color: "var(--text-inverted)",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  useSSE();
  const { error } = useAppBootstrap();
  const tasks = useTasks();
  const projects = useProjects();
  const habits = useHabits();
  const focus = useFocus();
  const review = useReview();
  const journal = useJournal();
  const calendar = useCalendar();
  const alarms = useAlarms();
  const packy = usePacky();
  const handleBadgeEarned = useCallback(
    (badge: { name: string; description: string }) => {
      void packy.updateLorebook(
        `Achievement: ${badge.name}`,
        `${badge.description} Earned ${new Date().toLocaleDateString()}.`,
      );
    },
    [packy],
  );
  const gamification = useGamification(handleBadgeEarned);
  const insights = useInsights();
  const notifications = useNotifications();
  const skin = useSkin();
  const layout = useLayout();
  const commandBar = useCommandBar();

  const [route, setRoute] = useState<AppRoute>(getRouteFromHash());
  const [focusModeEnabled, setFocusModeEnabled] = useState<boolean>(false);

  const { focusNow } = useFocusTimerController(focus.activeSession);
  const { activeTimerLabel } = useFocusTimer(focus.activeSession, focusNow);

  const overlay = useOverlayController();

  const commandExecutor = useCommandExecutor({
    tasks: { refresh: tasks.refresh },
    journal: { refresh: journal.refresh },
    calendar: { refresh: calendar.refresh },
    focus: { refresh: focus.refresh },
    alarms: { refresh: alarms.refresh },
    habits: { refresh: habits.refresh },
    review: { refresh: review.refresh },
    packy: { refresh: packy.refresh, ask: packy.ask },
  });

  const navigate = useCallback(
    (nextRoute: string): void => {
      if (nextRoute === "plan") {
        overlay.closeShutdown();
        overlay.openPlan();
        return;
      }
      if (nextRoute === "shutdown") {
        overlay.closePlan();
        overlay.openShutdown();
        return;
      }
      if (!isAppRoute(nextRoute)) {
        return;
      }
      window.location.hash = routeToHash(nextRoute);
      setRoute(nextRoute);
    },
    [overlay],
  );

  const handleCommandExecution = useCallback(
    async (
      text: string,
      options?: { source?: "text" | "voice"; clearOnHandled?: boolean },
    ): Promise<boolean> => {
      const success = await commandExecutor.execute(
        text,
        options,
        route,
        navigate,
      );
      if (options?.clearOnHandled !== false && success) {
        commandBar.setInput("");
      }
      return success;
    },
    [commandExecutor, route, navigate, commandBar],
  );

  useEffect(() => {
    const onHashChange = (): void => {
      const nextRoute = getRouteFromHash();
      if (nextRoute === "plan") {
        overlay.closeShutdown();
        overlay.openPlan();
        window.location.hash = routeToHash(getRouteFromHash());
        return;
      }
      if (nextRoute === "shutdown") {
        overlay.closePlan();
        overlay.openShutdown();
        window.location.hash = routeToHash(getRouteFromHash());
        return;
      }
      setRoute(nextRoute);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [overlay]);

  useEffect(() => {
    const openShutdown = (): void => {
      overlay.openShutdown();
    };
    window.addEventListener(
      "dopaflow:open-shutdown",
      openShutdown as EventListener,
    );
    return () =>
      window.removeEventListener(
        "dopaflow:open-shutdown",
        openShutdown as EventListener,
      );
  }, [overlay]);

  useKeyboardShortcuts({
    navigate,
    openPlanModal: overlay.openPlan,
  });

  useEffect(() => {
    if (route !== "today") {
      return;
    }
    if (overlay.shutdownOpen) {
      return;
    }
    const todayISO = localDateISO();
    const lastPlanned = localStorage.getItem(APP_STORAGE_KEYS.plannedDate);
    if (lastPlanned !== todayISO) {
      const t = setTimeout(() => overlay.openPlan(), 800);
      return () => clearTimeout(t);
    }
    return;
  }, [route, overlay.shutdownOpen, overlay]);

  const lastPackySyncRef = useRef<string>("");
  const lastXpRef = useRef<number | null>(null);
  const lastLevelRef = useRef<number | null>(null);

  useEffect(() => {
    const snapshot = {
      tasksDone: tasks.tasks.filter((task) => task.done).length,
      habitScore: habits.habits.reduce(
        (sum, habit) => sum + habit.current_streak,
        0,
      ),
      focusDone: focus.sessions.filter(
        (session) => session.status === "completed",
      ).length,
      reviewScore: review.cards.reduce(
        (sum, card) => sum + card.reviews_done,
        0,
      ),
      journalScore: journal.entries.reduce(
        (sum, entry) => sum + entry.version,
        0,
      ),
    };
    if (
      snapshot.tasksDone +
        snapshot.habitScore +
        snapshot.focusDone +
        snapshot.reviewScore +
        snapshot.journalScore >
      0
    ) {
      const syncKey = JSON.stringify(snapshot);
      if (lastPackySyncRef.current === syncKey) {
        return;
      }
      lastPackySyncRef.current = syncKey;
      void gamification.refresh();
      const focusMinutes = focus.sessions
        .filter((s) => s.status === "completed")
        .reduce(
          (sum, s) =>
            sum + ((s as { duration_minutes?: number }).duration_minutes ?? 0),
          0,
        );
      void packy.updateLorebook(
        "Daily sync",
        `Tasks: ${snapshot.tasksDone}, Streak: ${snapshot.habitScore}, Focus: ${focusMinutes}m`,
        {
          completed_today: snapshot.tasksDone,
          habit_streak: snapshot.habitScore,
          focus_minutes_today: focusMinutes,
        },
      );
    }
  }, [
    focus.sessions,
    gamification.refresh,
    habits.habits,
    journal.entries,
    packy.updateLorebook,
    review.cards,
    tasks.tasks,
  ]);

  useEffect(() => {
    const refreshGamification = (): void => {
      void gamification.refresh();
    };
    window.addEventListener(
      "dopaflow:gamification-refresh",
      refreshGamification as EventListener,
    );
    return () =>
      window.removeEventListener(
        "dopaflow:gamification-refresh",
        refreshGamification as EventListener,
      );
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
      showToast(
        `+${xpDelta} XP · Level ${level.level} · ${level.xp_to_next} to next`,
        "success",
      );
    }
    if (lastLevelRef.current !== null && level.level > lastLevelRef.current) {
      showToast(`Level up! You reached level ${level.level}.`, "success");
    }
    lastXpRef.current = level.total_xp;
    lastLevelRef.current = level.level;
  }, [gamification.level]);

  const SurfaceComponent = useMemo(() => getRouteComponent(route), [route]);

  if (error) {
    return <BootstrapErrorScreen />;
  }

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
        onInboxClick={overlay.openInbox}
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
        syncStatus="idle"
        skin={skin.skin}
      >
        <SurfaceComponent />
      </Shell>
      <AppOverlays
        inboxOpen={overlay.inboxOpen}
        planOpen={overlay.planOpen}
        shutdownOpen={overlay.shutdownOpen}
        onboardingOpen={overlay.onboardingOpen}
        notifications={notifications}
        gamification={gamification}
        projects={projects}
        tasks={tasks}
        journal={journal}
        habits={habits}
        navigate={navigate}
        onCommandExecute={async (text) => {
          await handleCommandExecution(text, {
            source: "text",
            clearOnHandled: false,
          });
        }}
        onCloseInbox={overlay.closeInbox}
        onClosePlan={overlay.closePlan}
        onCloseShutdown={overlay.closeShutdown}
        onFinishOnboarding={() => {
          const nextRoute = overlay.finishOnboarding();
          window.location.hash = routeToHash(nextRoute);
          setRoute(nextRoute);
        }}
        onSetOnboardingOpen={overlay.closeOnboarding}
      />
    </AppProviders>
  );
}
