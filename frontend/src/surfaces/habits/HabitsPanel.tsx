import type { Habit } from "../../../../shared/types";
import HabitCard from "./HabitCard";
import EmptyState from "@ds/primitives/EmptyState";
import { SkeletonList } from "@ds/primitives/Skeleton";

interface HabitsPanelProps {
  habits: Habit[];
  loading?: boolean;
  onCheckIn?: (id: string) => void;
  onRefresh?: () => void;
}

export function HabitsPanel({
  habits,
  loading = false,
  onCheckIn,
  onRefresh,
}: HabitsPanelProps): JSX.Element {
  if (loading) {
    return <SkeletonList rows={4} showAvatar />;
  }

  if (habits.length === 0) {
    return (
      <EmptyState
        icon="HB"
        title="No habits yet"
        subtitle="Build consistency — add your first habit above."
      />
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      {habits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          onCheckIn={onCheckIn}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

export default HabitsPanel;
