import type { Task } from '@shared/types';
import { APP_STORAGE_KEYS } from '../../app/appStorage';

const FOCUS_PREFILL_KEY = APP_STORAGE_KEYS.focusPrefill;
export const TODAY_KEY = APP_STORAGE_KEYS.plannedDate;

export interface TodayDayState {
  label: string;
  tone: string;
  bg: string;
}

export interface TodayActionCard {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryAction: () => void;
  secondaryLabel: string;
  secondaryAction: () => void;
}

export function isSameDay(dateText: string | null | undefined, target: Date): boolean {
  if (!dateText) {
    return false;
  }
  return new Date(dateText).toDateString() === target.toDateString();
}

export function getTodayDayState(dayOffset: number, plannedToday: boolean): TodayDayState {
  if (dayOffset === 0) {
    return plannedToday
      ? {
          label: 'Planned',
          tone: 'var(--state-completed)',
          bg: 'color-mix(in srgb, var(--state-completed) 12%, var(--surface))',
        }
      : {
          label: 'Needs plan',
          tone: 'var(--state-warn)',
          bg: 'color-mix(in srgb, var(--state-warn) 14%, var(--surface))',
        };
  }
  return {
    label: dayOffset > 0 ? 'Future' : 'Review',
    tone: 'var(--text-secondary)',
    bg: 'var(--surface-2)',
  };
}

export function getTodayNextAction(params: {
  activeFocusSession: boolean;
  dayOffset: number;
  plannedToday: boolean;
  overdueTasks: Task[];
  nextFocusTask: Task | null;
  backlog: Task[];
}): TodayActionCard {
  const { activeFocusSession, dayOffset, plannedToday, overdueTasks, nextFocusTask, backlog } =
    params;

  if (activeFocusSession) {
    return {
      eyebrow: 'In progress',
      title: 'Keep the current session moving',
      body: 'You already have an active focus block. Stay there until you pause, finish, or take a break.',
      primaryLabel: 'Open focus',
      primaryAction: () => {
        window.location.hash = '#/focus';
      },
      secondaryLabel: 'Review queue',
      secondaryAction: () => {
        window.location.hash = '#/today';
      },
    };
  }

  if (dayOffset === 0 && !plannedToday) {
    return {
      eyebrow: 'Missing plan',
      title: 'Plan the day before the backlog chooses for you',
      body: 'Run the planning ritual first so your top three and first focus block are explicit.',
      primaryLabel: 'Plan day',
      primaryAction: () => {
        window.location.hash = '#/plan';
      },
      secondaryLabel: 'Open tasks',
      secondaryAction: () => {
        window.location.hash = '#/tasks';
      },
    };
  }

  if (overdueTasks.length > 0) {
    return {
      eyebrow: 'Triage first',
      title: `${overdueTasks.length} older task${overdueTasks.length === 1 ? '' : 's'} need a decision`,
      body: 'Carry forward, reschedule, or drop them before you start another block and create more spillover.',
      primaryLabel: 'Open tasks',
      primaryAction: () => {
        window.location.hash = '#/tasks';
      },
      secondaryLabel: 'Open plan',
      secondaryAction: () => {
        window.location.hash = '#/plan';
      },
    };
  }

  if (nextFocusTask) {
    return {
      eyebrow: 'Ready to execute',
      title: `Start with ${nextFocusTask.title}`,
      body: 'Your queue is ready. Move straight into a focus block instead of reopening the whole backlog.',
      primaryLabel: 'Set up focus',
      primaryAction: () => {
        localStorage.setItem(FOCUS_PREFILL_KEY, nextFocusTask.title);
        window.location.hash = '#/focus';
      },
      secondaryLabel: 'Open calendar',
      secondaryAction: () => {
        window.location.hash = '#/calendar';
      },
    };
  }

  if (backlog.length > 0) {
    return {
      eyebrow: 'Queue empty',
      title: 'Pull one task into the day',
      body: 'Drag a backlog item into the queue so you have a clear next move instead of a long list.',
      primaryLabel: 'Open tasks',
      primaryAction: () => {
        window.location.hash = '#/tasks';
      },
      secondaryLabel: 'Review backlog',
      secondaryAction: () => {
        window.location.hash = '#/today';
      },
    };
  }

  return {
    eyebrow: 'Clear runway',
    title: 'You have room to plan intentionally',
    body: 'Nothing urgent is pulling at you. Use that space to plan tomorrow, review, or recover.',
    primaryLabel: 'Open overview',
    primaryAction: () => {
      window.location.hash = '#/overview';
    },
    secondaryLabel: 'Shutdown',
    secondaryAction: () => {
      window.location.hash = '#/shutdown';
    },
  };
}
