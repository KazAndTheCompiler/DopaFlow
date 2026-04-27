import { apiClient } from "./client";
import type {
  VaultStatus,
  VaultConfig,
  VaultConfigUpdate,
  VaultFileRecord,
  VaultPushResult,
  VaultPullResult,
  VaultRollbackResult,
  VaultConflictPreview,
  TaskImportPreview,
  TaskImportCandidate,
  VaultPullResult as ImportResult,
} from "../../../shared/types";

export async function getVaultStatus(): Promise<VaultStatus> {
  return apiClient<VaultStatus>("/vault/status");
}

export async function getVaultConfig(): Promise<VaultConfig> {
  return apiClient<VaultConfig>("/vault/config");
}

export async function updateVaultConfig(
  update: VaultConfigUpdate,
): Promise<VaultConfig> {
  return apiClient<VaultConfig>("/vault/config", {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

export async function pushJournal(): Promise<VaultPushResult> {
  return apiClient<VaultPushResult>("/vault/push/journal", { method: "POST" });
}

export async function pullJournal(): Promise<VaultPullResult> {
  return apiClient<VaultPullResult>("/vault/pull/journal", { method: "POST" });
}

export async function getVaultConflicts(): Promise<VaultFileRecord[]> {
  return apiClient<VaultFileRecord[]>("/vault/conflicts");
}

export async function getVaultConflictPreview(
  recordId: string,
): Promise<VaultConflictPreview> {
  return apiClient<VaultConflictPreview>(
    `/vault/conflicts/${recordId}/preview`,
  );
}

export async function rollbackVaultFile(
  recordId: string,
): Promise<VaultRollbackResult> {
  return apiClient<VaultRollbackResult>(`/vault/rollback/${recordId}`, {
    method: "POST",
  });
}

export async function resolveVaultConflict(filePath: string): Promise<void> {
  await apiClient(`/vault/resolve/${filePath}`, { method: "POST" });
}

export async function pushTasks(): Promise<VaultPushResult> {
  return apiClient<VaultPushResult>("/vault/push/tasks", { method: "POST" });
}

export async function pullTasks(): Promise<VaultPullResult> {
  return apiClient<VaultPullResult>("/vault/pull/tasks", { method: "POST" });
}

export async function pushDailyTasksSection(
  date: string,
): Promise<VaultPushResult> {
  return apiClient<VaultPushResult>(`/vault/push/daily-tasks/${date}`, {
    method: "POST",
  });
}

export async function previewTaskImport(): Promise<TaskImportPreview> {
  return apiClient<TaskImportPreview>("/vault/tasks/import-preview");
}

export async function confirmTaskImport(
  candidates: TaskImportCandidate[],
): Promise<ImportResult> {
  return apiClient<ImportResult>("/vault/tasks/import-confirm", {
    method: "POST",
    body: JSON.stringify({ candidates }),
  });
}
