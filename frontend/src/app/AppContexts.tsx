import { createContext, useContext } from "react";
import type { Context, ReactNode } from "react";

import type { useAlarms } from "../hooks/useAlarms";
import type { useCalendar } from "../hooks/useCalendar";
import type { useFocus } from "../hooks/useFocus";
import type { useGamification } from "../hooks/useGamification";
import type { useHabits } from "../hooks/useHabits";
import type { useInsights } from "../hooks/useInsights";
import type { useJournal } from "../hooks/useJournal";
import type { useLayout } from "../hooks/useLayout";
import type { useNotifications } from "../hooks/useNotifications";
import type { usePacky } from "../hooks/usePacky";
import type { useProjects } from "../hooks/useProjects";
import type { useReview } from "../hooks/useReview";
import type { useSkin } from "../hooks/useSkin";
import type { useTasks } from "../hooks/useTasks";

type TasksContextValue = ReturnType<typeof useTasks>;
type ProjectsContextValue = ReturnType<typeof useProjects>;
type HabitsContextValue = ReturnType<typeof useHabits>;
type FocusContextValue = ReturnType<typeof useFocus>;
type ReviewContextValue = ReturnType<typeof useReview>;
type JournalContextValue = ReturnType<typeof useJournal>;
type CalendarContextValue = ReturnType<typeof useCalendar>;
type AlarmsContextValue = ReturnType<typeof useAlarms>;
type PackyContextValue = ReturnType<typeof usePacky>;
type InsightsContextValue = ReturnType<typeof useInsights>;
type NotificationsContextValue = ReturnType<typeof useNotifications>;
type SkinContextValue = ReturnType<typeof useSkin>;
type LayoutContextValue = ReturnType<typeof useLayout>;
type GamificationContextValue = ReturnType<typeof useGamification>;

interface AppProvidersProps {
  children: ReactNode;
  tasks: TasksContextValue;
  projects: ProjectsContextValue;
  habits: HabitsContextValue;
  focus: FocusContextValue;
  review: ReviewContextValue;
  journal: JournalContextValue;
  calendar: CalendarContextValue;
  alarms: AlarmsContextValue;
  packy: PackyContextValue;
  insights: InsightsContextValue;
  notifications: NotificationsContextValue;
  skin: SkinContextValue;
  layout: LayoutContextValue;
  gamification: GamificationContextValue;
}

export interface AppContextValue {
  tasks: TasksContextValue;
  projects: ProjectsContextValue;
  habits: HabitsContextValue;
  focus: FocusContextValue;
  review: ReviewContextValue;
  journal: JournalContextValue;
  calendar: CalendarContextValue;
  alarms: AlarmsContextValue;
  packy: PackyContextValue;
  insights: InsightsContextValue;
  notifications: NotificationsContextValue;
  skin: SkinContextValue;
  layout: LayoutContextValue;
  gamification: GamificationContextValue;
}

export const AppDataContext = createContext<AppContextValue | null>(null);
const TasksContext = createContext<TasksContextValue | null>(null);
const ProjectsContext = createContext<ProjectsContextValue | null>(null);
const HabitsContext = createContext<HabitsContextValue | null>(null);
const FocusContext = createContext<FocusContextValue | null>(null);
const ReviewContext = createContext<ReviewContextValue | null>(null);
const JournalContext = createContext<JournalContextValue | null>(null);
const CalendarContext = createContext<CalendarContextValue | null>(null);
const AlarmsContext = createContext<AlarmsContextValue | null>(null);
const PackyContext = createContext<PackyContextValue | null>(null);
const InsightsContext = createContext<InsightsContextValue | null>(null);
const NotificationsContext = createContext<NotificationsContextValue | null>(null);
const SkinContext = createContext<SkinContextValue | null>(null);
const LayoutContext = createContext<LayoutContextValue | null>(null);
const GamificationContext = createContext<GamificationContextValue | null>(null);

function useRequiredContext<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${name} must be used inside AppProviders`);
  }
  return value;
}

export function AppProviders({
  children,
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
}: AppProvidersProps): JSX.Element {
  const appValue: AppContextValue = {
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
  };

  return (
    <AppDataContext.Provider value={appValue}>
      <TasksContext.Provider value={tasks}>
        <ProjectsContext.Provider value={projects}>
          <HabitsContext.Provider value={habits}>
            <FocusContext.Provider value={focus}>
              <ReviewContext.Provider value={review}>
                <JournalContext.Provider value={journal}>
                  <CalendarContext.Provider value={calendar}>
                    <AlarmsContext.Provider value={alarms}>
                      <PackyContext.Provider value={packy}>
                        <InsightsContext.Provider value={insights}>
                          <NotificationsContext.Provider value={notifications}>
                            <SkinContext.Provider value={skin}>
                              <LayoutContext.Provider value={layout}>
                                <GamificationContext.Provider value={gamification}>
                                  {children}
                                </GamificationContext.Provider>
                              </LayoutContext.Provider>
                            </SkinContext.Provider>
                          </NotificationsContext.Provider>
                        </InsightsContext.Provider>
                      </PackyContext.Provider>
                    </AlarmsContext.Provider>
                  </CalendarContext.Provider>
                </JournalContext.Provider>
              </ReviewContext.Provider>
            </FocusContext.Provider>
          </HabitsContext.Provider>
        </ProjectsContext.Provider>
      </TasksContext.Provider>
    </AppDataContext.Provider>
  );
}

export const useAppTasks = (): TasksContextValue => useRequiredContext(TasksContext, "useAppTasks");
export const useAppProjects = (): ProjectsContextValue => useRequiredContext(ProjectsContext, "useAppProjects");
export const useAppHabits = (): HabitsContextValue => useRequiredContext(HabitsContext, "useAppHabits");
export const useAppFocus = (): FocusContextValue => useRequiredContext(FocusContext, "useAppFocus");
export const useAppReview = (): ReviewContextValue => useRequiredContext(ReviewContext, "useAppReview");
export const useAppJournal = (): JournalContextValue => useRequiredContext(JournalContext, "useAppJournal");
export const useAppCalendar = (): CalendarContextValue => useRequiredContext(CalendarContext, "useAppCalendar");
export const useAppAlarms = (): AlarmsContextValue => useRequiredContext(AlarmsContext, "useAppAlarms");
export const useAppPacky = (): PackyContextValue => useRequiredContext(PackyContext, "useAppPacky");
export const useAppInsights = (): InsightsContextValue => useRequiredContext(InsightsContext, "useAppInsights");
export const useAppNotifications = (): NotificationsContextValue => useRequiredContext(NotificationsContext, "useAppNotifications");
export const useAppSkin = (): SkinContextValue => useRequiredContext(SkinContext, "useAppSkin");
export const useAppLayout = (): LayoutContextValue => useRequiredContext(LayoutContext, "useAppLayout");
export const useAppGamification = (): GamificationContextValue => useRequiredContext(GamificationContext, "useAppGamification");
