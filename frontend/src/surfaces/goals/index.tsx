import { useCallback, useEffect, useRef, useState } from 'react';

import { EmptyState } from '@ds/primitives/EmptyState';
import { GoalsSurfaceSkeleton } from '@ds/primitives/Skeleton';
import type { Goal } from '@api/goals';
import { addMilestone, completeMilestone, createGoal, deleteGoal, listGoals } from '@api/goals';

import { GoalCard } from './GoalCard';
import { GoalCreateForm } from './GoalCreateForm';
import { ensureGoalStyles, showGoalToast } from './GoalsShared';

ensureGoalStyles();

export default function GoalsView(): JSX.Element {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [horizon, setHorizon] = useState<Goal['horizon']>('quarter');
  const [milestoneInput, setMilestoneInput] = useState('');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listGoals();
      setGoals(data);
    } catch {
      showGoalToast('Failed to load goals', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async (): Promise<void> => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    setCreating(true);
    try {
      const milestone_labels = milestoneInput
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      await createGoal({
        title: trimmed,
        description: description.trim() || undefined,
        horizon,
        milestone_labels,
      });
      setTitle('');
      setDescription('');
      setMilestoneInput('');
      setHorizon('quarter');
      await refresh();
      showGoalToast('Goal created', 'warn');
    } catch {
      showGoalToast('Failed to create goal', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteMilestone = async (goalId: string, milestoneId: string): Promise<void> => {
    try {
      const updated = await completeMilestone(goalId, milestoneId);
      setGoals((prev) => prev.map((goal) => (goal.id === goalId ? updated : goal)));
    } catch {
      showGoalToast('Failed to complete milestone', 'error');
    }
  };

  const handleAddMilestone = async (goalId: string, label: string): Promise<void> => {
    try {
      const updated = await addMilestone(goalId, label);
      setGoals((prev) => prev.map((goal) => (goal.id === goalId ? updated : goal)));
    } catch {
      showGoalToast('Failed to add milestone', 'error');
    }
  };

  const handleDelete = async (goalId: string): Promise<void> => {
    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
      showGoalToast('Goal deleted', 'warn');
    } catch {
      showGoalToast('Failed to delete goal', 'error');
    }
  };

  if (loading) {
    return <GoalsSurfaceSkeleton />;
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <GoalCreateForm
        title={title}
        description={description}
        horizon={horizon}
        milestoneInput={milestoneInput}
        creating={creating}
        inputRef={inputRef}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onHorizonChange={setHorizon}
        onMilestoneInputChange={setMilestoneInput}
        onCreate={() => void handleCreate()}
      />

      {goals.length === 0 ? (
        <EmptyState
          icon="GL"
          title="No goals yet"
          subtitle="Set a long-term goal and break it into milestones to track progress."
        />
      ) : (
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              expanded={expandedGoalId === goal.id}
              onToggleExpanded={() =>
                setExpandedGoalId((current) => (current === goal.id ? null : goal.id))
              }
              onDelete={() => void handleDelete(goal.id)}
              onCompleteMilestone={(milestoneId) =>
                void handleCompleteMilestone(goal.id, milestoneId)
              }
              onAddMilestone={(label) => void handleAddMilestone(goal.id, label)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
