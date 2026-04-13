import { useCallback, useEffect, useState } from 'react';

import type { JournalEntry } from '../../../shared/types';
import {
  applyJournalTemplate,
  deleteJournalEntry,
  exportJournalToday,
  getJournalBacklinks,
  getJournalBackupStatus,
  getJournalEntry,
  getJournalGraph,
  type JournalGraphData,
  listJournalTemplates,
  listJournalEntries,
  saveJournalEntry,
  triggerJournalBackup,
} from '@api/index';
import { getInvalidationEventName } from './useSSE';

interface JournalTemplateSummary {
  id: string;
  name: string;
}

export interface UseJournalResult {
  entries: JournalEntry[];
  loading: boolean;
  backupPath?: string | null | undefined;
  lastBackupAt?: string | null | undefined;
  graph: JournalGraphData;
  templates: JournalTemplateSummary[];
  refresh: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  save: (entry: Partial<JournalEntry>) => Promise<JournalEntry>;
  getEntry: (identifier: string) => Promise<JournalEntry>;
  remove: (identifier: string) => Promise<void>;
  getBacklinks: (identifier: string) => Promise<string[]>;
  triggerBackup: (date?: string) => Promise<string>;
  applyTemplate: (templateId: string) => Promise<{ body: string; tags: string[] }>;
  exportToday: () => Promise<{ path: string; entry_count: number }>;
  refreshGraph: () => Promise<void>;
}

export function useJournal(): UseJournalResult {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [backupPath, setBackupPath] = useState<string | null>();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>();
  const [graph, setGraph] = useState<JournalGraphData>({ nodes: [], edges: [] });
  const [templates, setTemplates] = useState<JournalTemplateSummary[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [nextEntries, status] = await Promise.all([
        listJournalEntries(),
        getJournalBackupStatus(),
      ]);
      setEntries(nextEntries);
      setBackupPath(status.backup_path);
      setLastBackupAt(status.last_backup_at);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshGraph = useCallback(async (): Promise<void> => {
    const data = await getJournalGraph();
    setGraph(data);
  }, []);

  const refreshTemplates = useCallback(async (): Promise<void> => {
    const nextTemplates = await listJournalTemplates();
    setTemplates(nextTemplates.map((template) => ({ id: template.id, name: template.name })));
  }, []);

  const applyTemplate = useCallback(
    (templateId: string): Promise<{ body: string; tags: string[] }> =>
      applyJournalTemplate(templateId),
    [],
  );

  const exportToday = useCallback(
    (): Promise<{ path: string; entry_count: number }> => exportJournalToday(),
    [],
  );

  useEffect(() => {
    void refresh();
    void refreshGraph();
    void refreshTemplates();
  }, [refresh, refreshGraph, refreshTemplates]);

  useEffect(() => {
    const handleInvalidate = (): void => {
      void refresh();
      void refreshGraph();
      void refreshTemplates();
    };
    window.addEventListener(getInvalidationEventName('journal'), handleInvalidate);
    return () => window.removeEventListener(getInvalidationEventName('journal'), handleInvalidate);
  }, [refresh, refreshGraph, refreshTemplates]);

  return {
    entries,
    loading,
    backupPath,
    lastBackupAt,
    graph,
    templates,
    refresh,
    refreshTemplates,
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
    applyTemplate,
    exportToday,
  };
}
