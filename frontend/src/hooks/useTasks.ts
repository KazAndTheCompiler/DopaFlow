import { useCallback, useEffect, useState } from 'react';

import type { Task } from '../../../shared/types';
import { showToast } from '@ds/primitives/Toast';
import {
  addTaskDependency,
  bulkCompleteTask,
  bulkDeleteTask,
  completeTask,
  createTask,
  deleteTask,
  getTaskContext,
  listTasks,
  quickAddTask,
  removeTaskDependency,
  startTaskTimer,
  stopTaskTimer,
  updateTask,
} from '@api/index';
import { getInvalidationEventName } from './useSSE';

export interface TaskFilters {
  done: boolean | null;
  priority: number | null;
  dueToday: boolean;
}

export interface UseTasksResult {
  tasks: Task[];
  filteredTasks: Task[];
  filters: TaskFilters;
  setFilters: (filters: TaskFilters) => void;
  sortBy: string;
  setSortBy: (sortBy: string) => void;
  loading: boolean;
  error: string | null;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  createQuickTask: (text: string) => Promise<Task>;
  createStructuredTask: (task: Partial<Task>) => Promise<Task>;
  complete: (id: string) => Promise<void>;
  update: (id: string, patch: Partial<Task>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  bulkComplete: (ids: string[]) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  getContext: (id: string) => Promise<{ task: Task; dependencies: Task[]; dependents: Task[] }>;
  addDependency: (id: string, depId: string) => Promise<void>;
  removeDependency: (id: string, depId: string) => Promise<void>;
  startTimer: (id: string) => Promise<void>;
  stopTimer: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({
    done: null,
    priority: null,
    dueToday: false,
  });
  const [sortBy, setSortBy] = useState<string>('default');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await listTasks(sortBy);
      setTasks(response);
      setSelectedIds(new Set());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load tasks';
      setError(msg);
      showToast('Could not load tasks.', 'error');
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleInvalidate = (): void => {
      void refresh();
    };
    window.addEventListener(getInvalidationEventName('tasks'), handleInvalidate);
    return () => window.removeEventListener(getInvalidationEventName('tasks'), handleInvalidate);
  }, [refresh]);

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = (): void => {
    setSelectedIds(new Set());
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const filteredTasks = tasks.filter((task) => {
    if (filters.done !== null && task.done !== filters.done) {
      return false;
    }
    if (filters.priority !== null && task.priority !== filters.priority) {
      return false;
    }
    if (filters.dueToday) {
      const dueDate = task.due_at?.slice(0, 10);
      if (!dueDate || dueDate > todayIso) {
        return false;
      }
    }
    return true;
  });

  return {
    tasks,
    filteredTasks,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    loading,
    error,
    selectedIds,
    toggleSelect,
    clearSelection,
    createQuickTask: async (text: string) => {
      const parsed = await quickAddTask({ text });
      const title = parsed.title?.trim() || text.trim();
      if (!title) {
        throw new Error('task_title_required');
      }
      return createTask({ ...parsed, title });
    },
    createStructuredTask: async (task: Partial<Task>) => createTask(task),
    complete: async (id: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: true, status: 'done' as const } : t)),
      );
      try {
        await completeTask(id);
        window.dispatchEvent(new CustomEvent('dopaflow:gamification-refresh'));
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, done: false, status: 'todo' as const } : t)),
        );
        showToast('Failed to complete task.', 'error');
      }
    },
    update: async (id: string, patch: Partial<Task>) => {
      const snapshot = tasks;
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      try {
        await updateTask(id, patch);
      } catch {
        setTasks(snapshot);
        showToast('Failed to update task.', 'error');
      }
    },
    remove: async (id: string) => {
      const snapshot = tasks;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await deleteTask(id);
      } catch {
        setTasks(snapshot);
        showToast('Failed to delete task.', 'error');
      }
    },
    bulkComplete: async (ids: string[]) => {
      setTasks((prev) =>
        prev.map((t) => (ids.includes(t.id) ? { ...t, done: true, status: 'done' as const } : t)),
      );
      setSelectedIds(new Set());
      try {
        await bulkCompleteTask(ids);
        window.dispatchEvent(new CustomEvent('dopaflow:gamification-refresh'));
        showToast(`${ids.length} tasks completed.`, 'success');
      } catch {
        await refresh();
        showToast('Bulk complete failed.', 'error');
      }
    },
    bulkDelete: async (ids: string[]) => {
      const snapshot = tasks;
      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
      setSelectedIds(new Set());
      try {
        await bulkDeleteTask(ids);
        showToast(`${ids.length} tasks deleted.`, 'success');
      } catch {
        setTasks(snapshot);
        showToast('Bulk delete failed.', 'error');
      }
    },
    getContext: (id: string) => getTaskContext(id),
    addDependency: async (id: string, depId: string) => {
      await addTaskDependency(id, depId);
      await refresh();
    },
    removeDependency: async (id: string, depId: string) => {
      await removeTaskDependency(id, depId);
      await refresh();
    },
    startTimer: async (id: string) => {
      await startTaskTimer(id);
      await refresh();
    },
    stopTimer: async (id: string) => {
      await stopTaskTimer(id);
      await refresh();
    },
    refresh,
  };
}
