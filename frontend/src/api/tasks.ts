import type { Task } from "../../../shared/types";
import { apiClient } from "./client";

export interface TaskQuickAddInput {
  text: string;
}

export function listTasks(sortBy?: string): Promise<Task[]> {
  const url = new URL("http://127.0.0.1:8000/api/v2/tasks"); // Base URL for parameter building
  if (sortBy) {
    url.searchParams.set("sort_by", sortBy);
  }
  const queryString = url.search ? url.search.substring(1) : "";
  return apiClient<Task[]>("/tasks/" + (queryString ? `?${queryString}` : ""));
}

export function createTask(payload: Partial<Task>): Promise<Task> {
  return apiClient<Task>("/tasks/", { method: "POST", body: JSON.stringify(payload) });
}

export function quickAddTask(payload: TaskQuickAddInput): Promise<Partial<Task>> {
  return apiClient<Partial<Task>>("/tasks/quick-add", { method: "POST", body: JSON.stringify(payload) });
}

export function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  return apiClient<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function completeTask(id: string): Promise<Task> {
  return updateTask(id, { status: "done", done: true });
}

export function deleteTask(id: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/tasks/${id}`, { method: "DELETE" });
}

export function bulkCompleteTask(ids: string[]): Promise<{ completed: number }> {
  return apiClient<{ completed: number }>("/tasks/bulk/complete", { method: "POST", body: JSON.stringify({ ids }) });
}

export function bulkDeleteTask(ids: string[]): Promise<{ deleted: number }> {
  return apiClient<{ deleted: number }>("/tasks/bulk/delete", { method: "POST", body: JSON.stringify({ ids }) });
}

export function materializeRecurringTasks(windowHours = 168): Promise<{ created: number }> {
  return apiClient<{ created: number }>("/tasks/materialize-recurring", { method: "POST", body: JSON.stringify({ window_hours: windowHours }) });
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

export function startTaskTimer(id: string): Promise<Record<string, unknown>> {
  return apiClient(`/tasks/${id}/time/start`, { method: "POST" });
}

export function stopTaskTimer(id: string): Promise<Record<string, unknown>> {
  return apiClient(`/tasks/${id}/time/stop`, { method: "POST" });
}
