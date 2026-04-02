import { useCallback, useEffect, useState } from "react";

import type { CalendarEvent, PeerFeed, SyncConflict } from "../../../shared/types";
import {
  createCalendarEvent,
  getGoogleCalendarOAuthUrl,
  deleteCalendarEvent,
  getCalendarSyncStatus,
  listCalendarEvents,
  listPeerFeeds,
  listSyncConflicts,
  resolveSyncConflict,
  syncGoogleCalendar,
  syncPeerFeed,
} from "@api/index";

export interface UseCalendarResult {
  events: CalendarEvent[];
  syncStatus: string;
  conflicts: SyncConflict[];
  conflictCount: number;
  peerFeeds: PeerFeed[];
  refresh: (params?: { from?: string; until?: string }) => Promise<void>;
  refreshConflicts: () => Promise<void>;
  refreshPeerFeeds: () => Promise<void>;
  syncAllPeers: () => Promise<void>;
  create: (event: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  remove: (id: string) => Promise<void>;
  syncGoogle: () => Promise<void>;
  resolveConflict: (id: number, resolution: "prefer_local" | "prefer_incoming") => Promise<void>;
}

export function useCalendar(): UseCalendarResult {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [syncStatus, setSyncStatus] = useState<string>("idle");
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [peerFeeds, setPeerFeeds] = useState<PeerFeed[]>([]);

  const refreshPeerFeeds = useCallback(async (): Promise<void> => {
    const feeds = await listPeerFeeds();
    setPeerFeeds(feeds);
  }, []);

  const refreshConflicts = useCallback(async (): Promise<void> => {
    const next = await listSyncConflicts();
    setConflicts(next);
  }, []);

  const refresh = useCallback(async (params?: { from?: string; until?: string }): Promise<void> => {
    const [nextEvents, status] = await Promise.all([listCalendarEvents(params), getCalendarSyncStatus()]);
    setEvents(nextEvents);
    setSyncStatus(status.status);
  }, []);

  useEffect(() => {
    void refreshConflicts();
  }, [refreshConflicts]);

  useEffect(() => {
    void refreshPeerFeeds();
  }, [refreshPeerFeeds]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    events,
    syncStatus,
    conflicts,
    conflictCount: conflicts.length,
    peerFeeds,
    refresh,
    refreshConflicts,
    refreshPeerFeeds,
    syncAllPeers: async () => {
      await Promise.all(peerFeeds.map((f) => syncPeerFeed(f.id).catch(() => undefined)));
      await Promise.all([refresh(), refreshPeerFeeds()]);
    },
    create: async (event: Partial<CalendarEvent>) => {
      const created = await createCalendarEvent(event);
      await refresh();
      return created;
    },
    remove: async (id: string) => {
      await deleteCalendarEvent(id);
      await refresh();
    },
    syncGoogle: async () => {
      const redirectUri = `${window.location.origin}/api/v2/calendar/oauth/callback`;
      const result = await getGoogleCalendarOAuthUrl(redirectUri);
      if (result.status === "redirect" && result.url) {
        window.location.href = result.url;
        return;
      }
      await syncGoogleCalendar({ fetch_from: new Date().toISOString() });
      await Promise.all([refresh(), refreshConflicts()]);
    },
    resolveConflict: async (id: number, resolution: "prefer_local" | "prefer_incoming") => {
      await resolveSyncConflict(id, resolution);
      await refreshConflicts();
    },
  };
}
