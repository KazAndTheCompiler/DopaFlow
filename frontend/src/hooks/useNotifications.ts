import { useEffect, useState } from "react";

import type { Notification } from "../../../shared/types";
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from "@api/index";

export interface UseNotificationsResult {
  notifications: Notification[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState<number>(0);

  const refresh = async (): Promise<void> => {
    const [nextNotifications, unreadState] = await Promise.all([listNotifications(), getUnreadCount()]);
    setNotifications(nextNotifications);
    setUnread(unreadState.count);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    notifications,
    unread,
    refresh,
    markRead: async (id: string) => {
      await markNotificationRead(id);
      await refresh();
    },
    markAllRead: async () => {
      await markAllNotificationsRead();
      await refresh();
    },
  };
}
