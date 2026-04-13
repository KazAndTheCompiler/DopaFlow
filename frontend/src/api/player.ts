import { apiClient } from './client';

export interface QueueItem {
  url: string;
  title?: string;
  stream_url?: string;
}

interface PlayerQueueResponse {
  items: string[];
  count: number;
}

export interface ResolveResult {
  stream_url: string | null;
  error: string | null;
}

export function resolveUrl(url: string): Promise<ResolveResult> {
  return apiClient<ResolveResult>('/player/resolve-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

function normalizeQueue(items: string[]): QueueItem[] {
  return items.map((url) => ({ url, title: url }));
}

export async function getQueue(): Promise<{ items: QueueItem[]; count: number }> {
  const response = await apiClient<PlayerQueueResponse>('/player/queue');
  return { items: normalizeQueue(response.items), count: response.count };
}

export async function saveQueue(
  items: QueueItem[],
): Promise<{ items: QueueItem[]; count: number }> {
  const response = await apiClient<PlayerQueueResponse>('/player/queue', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
  return { items: normalizeQueue(response.items), count: response.count };
}
