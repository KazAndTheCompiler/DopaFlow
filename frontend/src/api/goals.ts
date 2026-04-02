import { apiClient } from "./client";

export interface GoalMilestone {
  id: string;
  label: string;
  done: boolean;
  completed_at?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  horizon: "week" | "month" | "quarter" | "year";
  milestones: GoalMilestone[];
  created_at: string;
  updated_at?: string;
  done: boolean;
}

export type CreateGoalPayload = {
  title: string;
  description?: string | undefined;
  horizon: Goal["horizon"];
  milestone_labels?: string[];
};

export function listGoals(): Promise<Goal[]> {
  return apiClient<Goal[]>("/goals");
}

export function createGoal(payload: CreateGoalPayload): Promise<Goal> {
  return apiClient<Goal>("/goals/", { method: "POST", body: JSON.stringify(payload) });
}

export function updateGoal(goalId: string, updates: Partial<Goal>): Promise<Goal> {
  return apiClient<Goal>(`/goals/${goalId}`, { method: "PATCH", body: JSON.stringify(updates) });
}

export function deleteGoal(goalId: string): Promise<{ ok: boolean }> {
  return apiClient<{ ok: boolean }>(`/goals/${goalId}`, { method: "DELETE" });
}

export function completeMilestone(goalId: string, milestoneId: string): Promise<Goal> {
  return apiClient<Goal>(`/goals/${goalId}/milestones/${milestoneId}/complete`, { method: "POST" });
}

export function addMilestone(goalId: string, label: string): Promise<Goal> {
  return apiClient<Goal>(`/goals/${goalId}/milestones`, { method: "POST", body: JSON.stringify({ label }) });
}
