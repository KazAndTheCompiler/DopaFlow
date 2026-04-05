import type { ReviewCard } from "../../../shared/types";
import { apiClient } from "./client";

export interface ReviewDeck {
  id: string;
  name: string;
  source_type?: string | null;
  card_count: number;
}

export interface DeckStats {
  deck_id: string;
  deck_name: string;
  total_cards: number;
  due_cards: number;
  suspended_count: number;
  average_interval: number;
}

export interface CreateReviewDeckResponse {
  id: string;
  name: string;
  source_type?: string | null;
}

export function listReviewCards(): Promise<ReviewCard[]> {
  return apiClient<ReviewCard[]>("/review/cards");
}

export function listReviewDecks(): Promise<ReviewDeck[]> {
  return apiClient<ReviewDeck[]>("/review/decks");
}

export function getDeckStats(deckId: string): Promise<DeckStats> {
  return apiClient<DeckStats>(`/review/decks/${deckId}/stats`);
}

export function createReviewDeck(payload: { name: string; source_type?: string }): Promise<CreateReviewDeckResponse> {
  return apiClient<CreateReviewDeckResponse>("/review/decks", { method: "POST", body: JSON.stringify(payload) });
}

export function createReviewCard(payload: Partial<ReviewCard>): Promise<ReviewCard> {
  return apiClient<ReviewCard>("/review/cards", { method: "POST", body: JSON.stringify(payload) });
}

export function rateReviewCard(payload: { cardId: string; rating: number }): Promise<ReviewCard> {
  return apiClient<ReviewCard>("/review/rate", { method: "POST", body: JSON.stringify(payload) });
}

export interface ImportApkgResponse {
  imported: number;
  skipped: number;
  source: string;
}

export function renameReviewDeck(deckId: string, name: string): Promise<ReviewDeck> {
  return apiClient<ReviewDeck>(`/review/decks/${deckId}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function deleteReviewDeck(deckId: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/review/decks/${deckId}`, { method: "DELETE" });
}

export function updateReviewCard(cardId: string, patch: { front: string; back: string }): Promise<ReviewCard> {
  return apiClient<ReviewCard>(`/review/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function importApkg(deckId: string, file: File): Promise<ImportApkgResponse> {
  const form = new FormData();
  form.append("file", file);
  const url = new URL(`${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v2"}/review/import-apkg`);
  url.searchParams.set("deck_id", deckId);
  const res = await fetch(url.toString(), { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ImportApkgResponse>;
}
