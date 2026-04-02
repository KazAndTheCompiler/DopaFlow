import { apiClient } from "./client";

export interface QueueItem {
  url: string;
  title?: string;
  stream_url?: string;
}

export interface ResolveResult {
  stream_url: string | null;
  error: string | null;
}

export function resolveUrl(url: string): Promise<ResolveResult> {
  return apiClient<ResolveResult>("/player/resolve-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function getQueue(): Promise<{ items: QueueItem[] }> {
  return apiClient<{ items: QueueItem[] }>("/player/queue");
}

export function saveQueue(items: QueueItem[]): Promise<{ items: QueueItem[] }> {
  return apiClient<{ items: QueueItem[] }>("/player/queue", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}
