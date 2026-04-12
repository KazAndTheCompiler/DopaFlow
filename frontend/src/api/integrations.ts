import type { IntegrationsStatus } from "../../../shared/types";
import { apiClient } from "./client";

export function connectGmail(payload: { code?: string; redirect_uri?: string; state?: string }): Promise<{ status: string; message?: string; url?: string }> {
  return apiClient<{ status: string; message?: string; url?: string }>("/integrations/gmail/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function importGmailTasks(): Promise<{ imported_count: number; status: string }> {
  return apiClient<{ imported_count: number; status: string }>("/integrations/gmail/import", { method: "POST" });
}

export function importGitHubIssues(payload: {
  token: string;
  repo: string;
  state?: "open" | "closed" | "all";
}): Promise<{ created: number; skipped: number; repo: string }> {
  return apiClient("/integrations/github/import-issues", { method: "POST", body: JSON.stringify(payload) });
}

export function enqueueWebhook(payload: { event_type: string; payload: Record<string, unknown> }): Promise<{
  status: string;
  event_type: string;
}> {
  return apiClient("/integrations/webhooks/outbox", { method: "POST", body: JSON.stringify(payload) });
}

export function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  return apiClient<IntegrationsStatus>("/integrations/status");
}
