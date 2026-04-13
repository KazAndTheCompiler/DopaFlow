import type { Notification } from '../../../shared/types';
import { apiClient } from './client';

export function listNotifications(): Promise<Notification[]> {
  return apiClient<Notification[]>('/notifications/');
}

export function createNotification(payload: Partial<Notification>): Promise<Notification> {
  return apiClient<Notification>('/notifications/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getUnreadCount(): Promise<{ count: number }> {
  return apiClient<{ count: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return apiClient<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiClient<{ updated: number }>('/notifications/read-all', { method: 'POST' });
}
