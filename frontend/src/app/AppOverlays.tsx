import { ToastContainer } from '@ds/primitives/Toast';
import NotificationInbox from '../components/NotificationInbox';
import AchievementToast from '../components/gamification/AchievementToast';
import CommandPalette from '../components/CommandPalette';
import type { AppRoute } from '../appRoutes';
import type { UseGamificationResult } from '../hooks/useGamification';
import type { UseHabitsResult } from '../hooks/useHabits';
import type { UseJournalResult } from '../hooks/useJournal';
import type { UseNotificationsResult } from '../hooks/useNotifications';
import type { UseProjectsResult } from '../hooks/useProjects';
import type { UseTasksResult } from '../hooks/useTasks';
import OnboardingModal from '../surfaces/onboarding/OnboardingModal';
import PlanMyDayModal from '../surfaces/plan/PlanMyDayModal';
import ShutdownModal from '../surfaces/shutdown/ShutdownModal';
import { APP_STORAGE_KEYS } from './appStorage';
import { localDateISO } from './AppShared';

interface AppOverlaysProps {
  inboxOpen: boolean;
  planOpen: boolean;
  shutdownOpen: boolean;
  onboardingOpen: boolean;
  notifications: UseNotificationsResult;
  gamification: UseGamificationResult;
  projects: UseProjectsResult;
  tasks: UseTasksResult;
  journal: UseJournalResult;
  habits: UseHabitsResult;
  navigate: (route: string) => void;
  onCommandExecute: (text: string) => Promise<void>;
  onCloseInbox: () => void;
  onClosePlan: () => void;
  onCloseShutdown: () => void;
  onFinishOnboarding: () => void;
  onSetOnboardingOpen: (open: boolean) => void;
}

export function AppOverlays({
  inboxOpen,
  planOpen,
  shutdownOpen,
  onboardingOpen,
  notifications,
  gamification,
  projects,
  tasks,
  journal,
  habits,
  navigate,
  onCommandExecute,
  onCloseInbox,
  onClosePlan,
  onCloseShutdown,
  onFinishOnboarding,
  onSetOnboardingOpen,
}: AppOverlaysProps): JSX.Element {
  return (
    <>
      <NotificationInbox
        open={inboxOpen}
        onClose={onCloseInbox}
        notifications={notifications.notifications}
        onRead={(id) => void notifications.markRead(id)}
        onReadAll={() => notifications.markAllRead()}
      />
      <AchievementToast badge={gamification.newBadge} onDismiss={gamification.dismissNewBadge} />
      <ToastContainer />
      {planOpen ? <PlanMyDayModal onClose={onClosePlan} onNavigate={navigate} /> : null}
      {shutdownOpen ? (
        <ShutdownModal
          completedToday={tasks.tasks.filter((task) => {
            const today = localDateISO();
            return task.done && task.updated_at?.slice(0, 10) === today;
          })}
          incompleteToday={tasks.tasks.filter((task) => {
            const today = localDateISO();
            return !task.done && task.due_at?.slice(0, 10) === today;
          })}
          tomorrowTasks={tasks.tasks.filter((task) => {
            const tomorrowISO = localDateISO(1);
            return !task.done && task.due_at?.slice(0, 10) === tomorrowISO;
          })}
          habits={habits.habits}
          onHabitCheckIn={(id) => void habits.checkIn(id)}
          onDefer={async (taskId, when) => {
            if (when === 'drop') {
              await tasks.update(taskId, { status: 'cancelled' });
              return;
            }
            const targetDate = localDateISO(when === 'tomorrow' ? 1 : 7);
            await tasks.update(taskId, { due_at: `${targetDate}T09:00:00Z` });
          }}
          onJournalNote={async (emoji, note) => {
            const habitSummary =
              habits.habits.length > 0
                ? `\n\n**Habits today**: ${habits.habits.filter((h) => (h.today_count ?? 0) >= h.target_freq).length}/${habits.habits.length} hit`
                : '';
            await journal.save({
              date: localDateISO(),
              markdown_body: note + habitSummary,
              emoji,
              tags: ['shutdown'],
            });
          }}
          onClose={onCloseShutdown}
        />
      ) : null}
      <CommandPalette
        projects={projects.projects}
        onProjectSelect={projects.setActiveProjectId}
        onNavigate={(route: AppRoute) => navigate(route)}
        onExecute={onCommandExecute}
      />
      {onboardingOpen ? (
        <OnboardingModal
          onCreateHabits={async (names) => {
            for (const name of names) {
              await habits.create({ name, target_freq: 1, target_period: 'day' });
            }
            await habits.refresh();
          }}
          onCreateTask={async (text) => {
            await tasks.createStructuredTask({ title: text, priority: 2 });
            await tasks.refresh();
          }}
          onFinish={() => {
            localStorage.setItem(APP_STORAGE_KEYS.onboardingComplete, '1');
            onSetOnboardingOpen(false);
            onFinishOnboarding();
          }}
        />
      ) : null}
    </>
  );
}
