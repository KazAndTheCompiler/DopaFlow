import type { JournalEntry } from "../../../shared/types";
import { apiClient } from "./client";

export interface JournalGraphNode {
  id: string;
  date: string;
  entry_count: number;
}

export interface JournalGraphEdge {
  source: string;
  target: string;
}

export interface JournalGraphData {
  nodes: JournalGraphNode[];
  edges: JournalGraphEdge[];
}

export function listJournalEntries(params?: { tag?: string; search?: string }): Promise<JournalEntry[]> {
  const qs = new URLSearchParams();
  if (params?.tag) qs.set("tag", params.tag);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<JournalEntry[]>(`/journal/entries${query}`);
}

export function getJournalEntry(identifier: string): Promise<JournalEntry> {
  return apiClient<JournalEntry>(`/journal/entries/${identifier}`);
}

export function saveJournalEntry(payload: Partial<JournalEntry>): Promise<JournalEntry> {
  return apiClient<JournalEntry>("/journal/entries", { method: "POST", body: JSON.stringify(payload) });
}

export function deleteJournalEntry(identifier: string): Promise<{ deleted: boolean; identifier: string }> {
  return apiClient(`/journal/entries/${identifier}`, { method: "DELETE" });
}

export function getJournalBackupStatus(): Promise<{ backup_path?: string | null; last_backup_at?: string | null }> {
  return apiClient<{ backup_path?: string | null; last_backup_at?: string | null }>("/journal/backup-status");
}

export function triggerJournalBackup(date?: string): Promise<{ message: string; backed_up_date?: string }> {
  const qs = date ? `?date=${date}` : "";
  return apiClient(`/journal/backup/trigger${qs}`, { method: "POST" });
}

export function getJournalGraph(): Promise<JournalGraphData> {
  return apiClient<JournalGraphData>("/journal/graph");
}

export function getJournalBacklinks(identifier: string): Promise<string[]> {
  return apiClient<string[]>(`/journal/${identifier}/backlinks`);
}

export function exportJournalToday(): Promise<{ path: string; entry_count: number }> {
  return apiClient<{ path: string; entry_count: number }>("/journal/export-today", { method: "POST" });
}
