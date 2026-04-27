import { useCallback } from "react";
import { showToast } from "@ds/primitives/Toast";
import { intentRoutes, actionRoutes } from "../appRoutes";
import type { RouteIntentAction } from "../appRoutes";
import { getCommandReply } from "./AppShared";
import type { UseTasksResult } from "../hooks/useTasks";
import type { UseJournalResult } from "../hooks/useJournal";
import type { UseCalendarResult } from "../hooks/useCalendar";
import type { UseFocusResult } from "../hooks/useFocus";
import type { UseAlarmsResult } from "../hooks/useAlarms";
import type { UseHabitsResult } from "../hooks/useHabits";
import type { UseReviewResult } from "../hooks/useReview";
import type { UsePackyResult } from "../hooks/usePacky";
import type { AppRoute } from "../appRoutes";

interface RefreshMap {
  "task.create": () => Promise<void>;
  "task.complete": () => Promise<void>;
  "task.list": () => Promise<void>;
  "journal.create": () => Promise<void>;
  "calendar.create": () => Promise<void>;
  "focus.start": () => Promise<void>;
  "alarm.create": () => Promise<void>;
  "habit.checkin": () => Promise<void>;
  "habit.list": () => Promise<void>;
  "review.start": () => Promise<void>;
  search: () => Promise<void>;
  "nutrition.log": () => Promise<void>;
  undo: () => Promise<void>;
}

export interface CommandExecutorDeps {
  tasks: Pick<UseTasksResult, "refresh">;
  journal: Pick<UseJournalResult, "refresh">;
  calendar: Pick<UseCalendarResult, "refresh">;
  focus: Pick<UseFocusResult, "refresh">;
  alarms: Pick<UseAlarmsResult, "refresh">;
  habits: Pick<UseHabitsResult, "refresh">;
  review: Pick<UseReviewResult, "refresh">;
  packy: Pick<UsePackyResult, "refresh" | "ask">;
}

export interface UseCommandExecutorResult {
  execute: (
    text: string,
    options?: { source?: "text" | "voice"; clearOnHandled?: boolean },
    currentRoute?: AppRoute,
    navigate?: (route: AppRoute) => void,
  ) => Promise<boolean>;
}

export function useCommandExecutor(
  deps: CommandExecutorDeps,
): UseCommandExecutorResult {
  const { tasks, journal, calendar, focus, alarms, habits, review, packy } =
    deps;

  const refreshers: RefreshMap = {
    "task.create": tasks.refresh,
    "task.complete": tasks.refresh,
    "task.list": tasks.refresh,
    "journal.create": journal.refresh,
    "calendar.create": calendar.refresh,
    "focus.start": focus.refresh,
    "alarm.create": alarms.refresh,
    "habit.checkin": habits.refresh,
    "habit.list": habits.refresh,
    "review.start": review.refresh,
    search: async () => {},
    "nutrition.log": async () => {
      window.dispatchEvent(new CustomEvent("dopaflow:nutrition-logged"));
    },
    undo: tasks.refresh,
  };

  const execute = useCallback(
    async (
      text: string,
      options?: { source?: "text" | "voice"; clearOnHandled?: boolean },
      currentRoute?: AppRoute,
      navigate?: (route: AppRoute) => void,
    ): Promise<boolean> => {
      const raw = text.trim();
      if (!raw) {
        return false;
      }

      const source = options?.source ?? "text";

      try {
        const { executeCommandText } = await import("../api/commands");
        const result = await executeCommandText(raw, true, source);
        const intent = typeof result.intent === "string" ? result.intent : "";
        const status = typeof result.status === "string" ? result.status : "";
        const reply = getCommandReply(result);

        if (status === "executed") {
          const refresher = refreshers[intent as keyof RefreshMap];
          if (refresher) {
            try {
              await refresher();
            } catch {
              // Keep command success visible even if a follow-up refresh fails.
            }
          }
          void packy.refresh().catch(() => undefined);

          const nextRoute = intentRoutes[intent as keyof typeof intentRoutes];
          if (nextRoute && nextRoute !== currentRoute && navigate) {
            navigate(nextRoute);
          }

          if (reply) {
            showToast(reply, "success");
          } else {
            showToast("Command completed.", "success");
          }

          if (options?.clearOnHandled !== false) {
            // Caller handles command bar clearing
          }
          return true;
        }

        if (reply) {
          showToast(reply, status === "error" ? "error" : "info");
        } else if (status === "needs_datetime") {
          showToast(
            "I need a date and time before I can schedule that.",
            "warn",
          );
        }

        if (
          status === "greeting" ||
          status === "help" ||
          status === "unknown" ||
          status === "ok"
        ) {
          try {
            const packyResult = await packy.ask(raw, {
              route: currentRoute ?? "today",
            });
            const nextRoute =
              actionRoutes[packyResult.action as RouteIntentAction];
            if (nextRoute && nextRoute !== currentRoute && navigate) {
              navigate(nextRoute);
            }
            if (packyResult.reply && packyResult.reply !== reply) {
              showToast(packyResult.reply, "info");
            }
            if (options?.clearOnHandled !== false) {
              // Caller handles command bar clearing
            }
            return true;
          } catch (error) {
            console.error(
              "[DopaFlow] Packy fallback failed after command response",
              error,
            );
          }
        }

        return status !== "error";
      } catch (error) {
        console.error("[DopaFlow] Command execution failed", error);
        showToast(
          "Command failed. The input is still there so you can retry or edit it.",
          "error",
        );
        return false;
      }
    },
    [packy, refreshers],
  );

  return { execute };
}
