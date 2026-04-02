import type { ShareToken, ShareTokenCreated, PeerFeed, PeerFeedSyncResult } from "../../../shared/types";
import { apiClient } from "./client";

export function listShareTokens(): Promise<ShareToken[]> {
  return apiClient<ShareToken[]>("/calendar/sharing/tokens");
}

export function createShareToken(label: string, expiresInDays: number | null = 30): Promise<ShareTokenCreated> {
  return apiClient<ShareTokenCreated>("/calendar/sharing/tokens", {
    method: "POST",
    body: JSON.stringify({ label, expires_in_days: expiresInDays }),
  });
}

export function revokeShareToken(id: string): Promise<{ revoked: boolean }> {
  return apiClient(`/calendar/sharing/tokens/${id}`, { method: "DELETE" });
}

export function getShareTokenInvite(id: string): Promise<{ connection_string: string; label: string }> {
  return apiClient(`/calendar/sharing/tokens/${id}/invite`);
}

export function listPeerFeeds(): Promise<PeerFeed[]> {
  return apiClient<PeerFeed[]>("/calendar/sharing/feeds");
}

export function addPeerFeed(payload: {
  label: string;
  base_url: string;
  token: string;
  color?: string;
}): Promise<PeerFeed> {
  return apiClient<PeerFeed>("/calendar/sharing/feeds", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePeerFeed(
  id: string,
  patch: { label?: string; color?: string }
): Promise<PeerFeed> {
  return apiClient<PeerFeed>(`/calendar/sharing/feeds/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function removePeerFeed(id: string): Promise<{ removed: boolean }> {
  return apiClient(`/calendar/sharing/feeds/${id}`, { method: "DELETE" });
}

export function syncPeerFeed(id: string): Promise<PeerFeedSyncResult> {
  return apiClient<PeerFeedSyncResult>(`/calendar/sharing/feeds/${id}/sync`, {
    method: "POST",
  });
}
