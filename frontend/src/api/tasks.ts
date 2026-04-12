import type { Task, TaskQuickAddPreview, TaskTimeLog } from "../../../shared/types";
import { apiClient } from "./client";
import { parseApiSchema, taskSchema, tasksSchema } from "./schemas";

export interface TaskQuickAddInput {
  text: string;
}

export async function listTasks(sortBy?: string): Promise<Task[]> {
  const params = new URLSearchParams();
  if (sortBy) {
    params.set("sort_by", sortBy);
  }
  const queryString = params.toString();
  return parseApiSchema<Task[]>(tasksSchema, await apiClient<unknown>("/tasks/" + (queryString ? `?${queryString}` : "")));
}

export async function createTask(payload: Partial<Task>): Promise<Task> {
  return parseApiSchema<Task>(taskSchema, await apiClient<unknown>("/tasks/", { method: "POST", body: JSON.stringify(payload) }));
}

export function quickAddTask(payload: TaskQuickAddInput): Promise<TaskQuickAddPreview> {
  return apiClient<TaskQuickAddPreview>("/tasks/quick-add", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  return parseApiSchema<Task>(taskSchema, await apiClient<unknown>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }));
}

export function completeTask(id: string): Promise<Task> {
  return updateTask(id, { status: "done", done: true });
}

export function deleteTask(id: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/tasks/${id}`, { method: "DELETE" });
}

export function bulkCompleteTask(ids: string[]): Promise<{ updated: number }> {
  return apiClient<{ updated: number }>("/tasks/bulk/complete", { method: "POST", body: JSON.stringify({ ids }) });
}

export function bulkDeleteTask(ids: string[]): Promise<{ updated: number }> {
  return apiClient<{ updated: number }>("/tasks/bulk/delete", { method: "POST", body: JSON.stringify({ ids }) });
}

export function materializeRecurringTasks(windowHours = 168): Promise<{ created: number }> {
  return apiClient<{ created: number }>(`/tasks/materialize-recurring?window_hours=${windowHours}`, { method: "POST" });
}

export function getTaskContext(id: string): Promise<{ task: Task; dependencies: Task[]; dependents: Task[] }> {
  return apiClient(`/tasks/${id}/context`);
}

export function addTaskDependency(id: string, depId: string): Promise<{ ok: boolean }> {
  return apiClient(`/tasks/${id}/deps/${depId}`, { method: "POST" });
}

export function removeTaskDependency(id: string, depId: string): Promise<{ ok: boolean }> {
  return apiClient(`/tasks/${id}/deps/${depId}`, { method: "DELETE" });
}

export function startTaskTimer(id: string): Promise<TaskTimeLog> {
  return apiClient(`/tasks/${id}/time/start`, { method: "POST" });
}

export function stopTaskTimer(id: string): Promise<TaskTimeLog> {
  return apiClient(`/tasks/${id}/time/stop`, { method: "POST" });
}
