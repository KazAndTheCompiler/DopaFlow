import { useCallback, useEffect, useState } from 'react';

import type { Project } from '@shared/types';
import { showToast } from '@ds/primitives/Toast';
import {
  createProject,
  deleteProject,
  getProjectTaskCounts,
  listProjects,
  updateProject,
} from '@api/projects';
import { getInvalidationEventName } from './useSSE';

export interface UseProjectsResult {
  projects: Project[];
  taskCounts: Record<string, number>;
  loading: boolean;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  create: (payload: Partial<Project>) => Promise<Project>;
  update: (id: string, patch: Partial<Project>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [ps, counts] = await Promise.all([listProjects(), getProjectTaskCounts()]);
      setProjects(ps);
      setTaskCounts(counts);
    } catch {
      showToast('Could not load projects.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleTasksInvalidate = (): void => {
      void refresh();
    };
    window.addEventListener(getInvalidationEventName('tasks'), handleTasksInvalidate);
    return () =>
      window.removeEventListener(getInvalidationEventName('tasks'), handleTasksInvalidate);
  }, [refresh]);

  return {
    projects,
    taskCounts,
    loading,
    activeProjectId,
    setActiveProjectId,
    create: async (payload) => {
      const p = await createProject(payload);
      await refresh();
      showToast(`Project "${p.name}" created.`, 'success');
      return p;
    },
    update: async (id, patch) => {
      await updateProject(id, patch);
      await refresh();
    },
    remove: async (id) => {
      await deleteProject(id);
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
      await refresh();
    },
    refresh,
  };
}
