import type { Project } from "@shared/types";
import { apiClient } from "./client";

export function listProjects(): Promise<Project[]> {
  return apiClient<Project[]>("/projects");
}

export function createProject(payload: Partial<Project>): Promise<Project> {
  return apiClient<Project>("/projects", { method: "POST", body: JSON.stringify(payload) });
}

export function updateProject(id: string, patch: Partial<Project>): Promise<Project> {
  return apiClient<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteProject(id: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/projects/${id}`, { method: "DELETE" });
}

export function getProjectTaskCounts(): Promise<Record<string, number>> {
  return apiClient<Record<string, number>>("/projects/task-counts");
}
