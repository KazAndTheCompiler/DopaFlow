import type { ReviewCard } from '../../../shared/types';
import { apiClient, API_BASE_URL } from './client';
import { parseApiSchema, reviewCardSchema, reviewCardsSchema } from './schemas';

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

export async function listReviewCards(): Promise<ReviewCard[]> {
  return parseApiSchema<ReviewCard[]>(reviewCardsSchema, await apiClient<unknown>('/review/cards'));
}

export function listReviewDecks(): Promise<ReviewDeck[]> {
  return apiClient<ReviewDeck[]>('/review/decks');
}

export async function listDueReviewCards(
  deckId: string,
  limit = 20,
  offset = 0,
): Promise<ReviewCard[]> {
  const params = new URLSearchParams({
    deck_id: deckId,
    limit: String(limit),
    offset: String(offset),
  });
  return parseApiSchema<ReviewCard[]>(
    reviewCardsSchema,
    await apiClient<unknown>(`/review/due?${params.toString()}`),
  );
}

export function getDeckStats(deckId: string): Promise<DeckStats> {
  return apiClient<DeckStats>(`/review/decks/${deckId}/stats`);
}

export function createReviewDeck(payload: {
  name: string;
  source_type?: string;
}): Promise<CreateReviewDeckResponse> {
  return apiClient<CreateReviewDeckResponse>('/review/decks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createReviewCard(payload: Partial<ReviewCard>): Promise<ReviewCard> {
  return parseApiSchema<ReviewCard>(
    reviewCardSchema,
    await apiClient<unknown>('/review/cards', { method: 'POST', body: JSON.stringify(payload) }),
  );
}

export async function rateReviewCard(payload: {
  cardId: string;
  rating: number;
}): Promise<ReviewCard> {
  return parseApiSchema<ReviewCard>(
    reviewCardSchema,
    await apiClient<unknown>('/review/rate', { method: 'POST', body: JSON.stringify(payload) }),
  );
}

export interface ImportApkgResponse {
  imported: number;
  skipped: number;
  source: string;
}

export function renameReviewDeck(deckId: string, name: string): Promise<ReviewDeck> {
  return apiClient<ReviewDeck>(`/review/decks/${deckId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteReviewDeck(deckId: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/review/decks/${deckId}`, { method: 'DELETE' });
}

export async function updateReviewCard(
  cardId: string,
  patch: { front: string; back: string },
): Promise<ReviewCard> {
  return parseApiSchema<ReviewCard>(
    reviewCardSchema,
    await apiClient<unknown>(`/review/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  );
}

export async function importApkg(deckId: string, file: File): Promise<ImportApkgResponse> {
  const form = new FormData();
  form.append('file', file);
  const url = new URL(`${API_BASE_URL}/review/import-apkg`);
  url.searchParams.set('deck_id', deckId);
  const res = await fetch(url.toString(), { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<ImportApkgResponse>;
}
