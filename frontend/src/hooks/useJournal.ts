import { useCallback, useEffect, useState } from "react";

import type { JournalEntry } from "../../../shared/types";
import {
  deleteJournalEntry,
  getJournalBacklinks,
  getJournalBackupStatus,
  getJournalEntry,
  getJournalGraph,
  listJournalEntries,
  saveJournalEntry,
  triggerJournalBackup,
} from "@api/index";

export interface JournalGraphData {
  nodes: Array<{ id: string; date: string; entry_count: number }>;
  edges: Array<{ source: string; target: string }>;
}

export interface UseJournalResult {
  entries: JournalEntry[];
  backupPath?: string | null | undefined;
  lastBackupAt?: string | null | undefined;
  graph: JournalGraphData;
  refresh: () => Promise<void>;
  save: (entry: Partial<JournalEntry>) => Promise<JournalEntry>;
  getEntry: (identifier: string) => Promise<JournalEntry>;
  remove: (identifier: string) => Promise<void>;
  getBacklinks: (identifier: string) => Promise<string[]>;
  triggerBackup: (date?: string) => Promise<string>;
  refreshGraph: () => Promise<void>;
}

export function useJournal(): UseJournalResult {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [backupPath, setBackupPath] = useState<string | null>();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>();
  const [graph, setGraph] = useState<JournalGraphData>({ nodes: [], edges: [] });

  const refresh = useCallback(async (): Promise<void> => {
    const [nextEntries, status] = await Promise.all([listJournalEntries(), getJournalBackupStatus()]);
    setEntries(nextEntries);
    setBackupPath(status.backup_path);
    setLastBackupAt(status.last_backup_at);
  }, []);

  const refreshGraph = useCallback(async (): Promise<void> => {
    const data = await getJournalGraph();
    setGraph(data as JournalGraphData);
  }, []);

  useEffect(() => {
    void refresh();
    void refreshGraph();
  }, [refresh, refreshGraph]);

  return {
    entries,
    backupPath,
    lastBackupAt,
    graph,
    refresh,
    refreshGraph,
    save: async (entry: Partial<JournalEntry>): Promise<JournalEntry> => {
      const saved = await saveJournalEntry(entry);
      await refresh();
      return saved;
    },
    getEntry: (identifier: string) => getJournalEntry(identifier),
    remove: async (identifier: string): Promise<void> => {
      await deleteJournalEntry(identifier);
      await refresh();
    },
    getBacklinks: (identifier: string) => getJournalBacklinks(identifier),
    triggerBackup: async (date?: string): Promise<string> => {
      const result = await triggerJournalBackup(date);
      await refresh();
      return result.message;
    },
  };
}
