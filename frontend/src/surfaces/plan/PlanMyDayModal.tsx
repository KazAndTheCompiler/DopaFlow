import { useEffect, useState } from "react";

import type { Task } from "../../../../shared/types";
import {
  useAppCalendar,
  useAppFocus,
  useAppHabits,
  useAppPacky,
  useAppTasks,
} from "../../app/AppContexts";
import { APP_STORAGE_KEYS } from "../../app/appStorage";
import {
  ENERGY_LEVELS,
  isOverdue,
  MAX_PICKS,
  STEP_TITLES,
  TODAY_KEY,
  TOTAL_STEPS,
  todayISO,
  yesterdayISO,
} from "./PlanMyDayShared";
import { CarryForward } from "./PlanMyDayCarryForward";
import { Commit } from "./PlanMyDayCommit";
import { EnergyCheck } from "./PlanMyDayEnergyCheck";
import { PlanMyDayFrame } from "./PlanMyDayFrame";
import { PickThree } from "./PlanMyDayPickThree";
import { StepDots } from "./PlanMyDayStepDots";

// ── Main modal ─────────────────────────────────────────────────────────────────

const PLAN_MY_DAY_SESSION_KEY = "dopaflow:planmyday";

interface PlanMyDayModalProps {
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export default function PlanMyDayModal({
  onClose,
  onNavigate,
}: PlanMyDayModalProps): JSX.Element | null {
  const tasksState = useAppTasks();
  const focus = useAppFocus();
  const habits = useAppHabits();
  const calendar = useAppCalendar();
  const packy = useAppPacky();
  const [step, setStep] = useState(0);
  const [energy, setEnergy] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<
    Record<string, "keep" | "postpone" | "drop">
  >({});
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const today = todayISO();

  const tasks = tasksState.tasks;
  const overdue = tasks.filter(
    (t) =>
      !t.done &&
      t.status !== "cancelled" &&
      t.status !== "done" &&
      isOverdue(t),
  );

  // Pre-select top 3 by priority when entering step 2
  const priorityOrder: Record<Task["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  useEffect(() => {
    if (step === 2 && picks.size === 0) {
      const pre = tasks
        .filter(
          (t) =>
            !t.done &&
            t.status !== "cancelled" &&
            t.status !== "done" &&
            !isOverdue(t),
        )
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
        .slice(0, MAX_PICKS);
      setPicks(new Set(pre.map((t) => t.id)));
    }
  }, [picks.size, step, tasks]);

  useEffect(() => {
    const raw = sessionStorage.getItem(PLAN_MY_DAY_SESSION_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        date?: string;
        step?: number;
        selected?: {
          energy?: number | null;
          decisions?: Record<string, "keep" | "postpone" | "drop">;
          picks?: string[];
        };
      };
      if (parsed.date !== today) {
        sessionStorage.removeItem(PLAN_MY_DAY_SESSION_KEY);
        return;
      }
      setStep(
        typeof parsed.step === "number"
          ? Math.max(0, Math.min(parsed.step, TOTAL_STEPS - 1))
          : 0,
      );
      setEnergy(
        typeof parsed.selected?.energy === "number"
          ? parsed.selected.energy
          : null,
      );
      setDecisions(parsed.selected?.decisions ?? {});
      setPicks(new Set(parsed.selected?.picks ?? []));
    } catch {
      sessionStorage.removeItem(PLAN_MY_DAY_SESSION_KEY);
    }
  }, [today]);

  useEffect(() => {
    sessionStorage.setItem(
      PLAN_MY_DAY_SESSION_KEY,
      JSON.stringify({
        date: today,
        step,
        selected: {
          energy,
          decisions,
          picks: Array.from(picks),
        },
      }),
    );
  }, [decisions, energy, picks, step, today]);

  // Yesterday's stats
  const yISO = yesterdayISO();
  const yesterdayTasks = tasks.filter(
    (t) =>
      t.done &&
      (t as { updated_at?: string }).updated_at?.slice(0, 10) === yISO,
  ).length;
  const yesterdayFocus = focus.sessions
    .filter(
      (s) =>
        s.status === "completed" &&
        (s as { ended_at?: string }).ended_at?.slice(0, 10) === yISO,
    )
    .reduce(
      (sum, s) =>
        sum + ((s as { duration_minutes?: number }).duration_minutes ?? 0),
      0,
    );
  const habitStreak = habits.habits.reduce(
    (max, h) => Math.max(max, h.current_streak ?? 0),
    0,
  );

  // Today's events
  const todayEvents = calendar.events
    .filter((e) => e.start_at?.slice(0, 10) === today)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const pending = tasks
    .filter(
      (t) =>
        !t.done &&
        t.status !== "cancelled" &&
        t.status !== "done" &&
        !isOverdue(t),
    )
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const handleDecide = (id: string, d: "keep" | "postpone" | "drop"): void => {
    setDecisions((prev) => ({ ...prev, [id]: d }));
  };

  const handleTogglePick = (id: string): void => {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_PICKS) {
        next.add(id);
      }
      return next;
    });
  };

  const applyDecisions = async (): Promise<void> => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomorrowISO = tom.toISOString().slice(0, 10);
    for (const [id, decision] of Object.entries(decisions)) {
      if (decision === "drop") {
        await tasksState.update(id, { status: "cancelled" });
      } else if (decision === "postpone") {
        await tasksState.update(id, { due_at: tomorrowISO });
      }
    }
  };

  const complete = async (
    dest: "tasks" | "focus",
    focusTitle?: string,
  ): Promise<void> => {
    await applyDecisions();
    if (energy !== null) {
      const level = ENERGY_LEVELS[energy];
      void packy.updateLorebook(
        `Energy: ${level.label}`,
        `Morning energy logged as ${level.label} (${level.value}/4)`,
      );
    }
    localStorage.setItem(TODAY_KEY, today);
    sessionStorage.removeItem(PLAN_MY_DAY_SESSION_KEY);
    if (dest === "focus" && focusTitle) {
      localStorage.setItem(APP_STORAGE_KEYS.focusPrefill, focusTitle);
    }
    onNavigate(dest);
    onClose();
  };

  const whisper = packy.whisper?.text ?? "";

  return (
    <PlanMyDayFrame stepTitle={STEP_TITLES[step]} onClose={onClose}>
      <StepDots step={step} total={TOTAL_STEPS} />

      {step === 0 && (
        <EnergyCheck
          energy={energy}
          onPick={(v) => {
            setEnergy(v);
          }}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <CarryForward
          overdue={overdue}
          decisions={decisions}
          yesterdayStats={{
            tasks: yesterdayTasks,
            focusMin: yesterdayFocus,
            streak: habitStreak,
          }}
          onDecide={handleDecide}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <PickThree
          pending={pending}
          picks={picks}
          todayEvents={todayEvents}
          onToggle={handleTogglePick}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Commit
          picks={picks}
          tasks={tasks}
          whisper={whisper}
          energy={energy}
          onStartTasks={() => void complete("tasks")}
          onStartFocus={(title) => void complete("focus", title)}
          onBack={() => setStep(2)}
        />
      )}
    </PlanMyDayFrame>
  );
}
