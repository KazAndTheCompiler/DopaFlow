import { useEffect, useState } from 'react';

import type { ReviewCard } from '../../../shared/types';
import { createReviewCard, listReviewCards, rateReviewCard } from '@api/index';

export interface UseReviewResult {
  cards: ReviewCard[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (card: Partial<ReviewCard>) => Promise<ReviewCard>;
  rate: (cardId: string, rating: number) => Promise<void>;
}

export function useReview(): UseReviewResult {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      setCards(await listReviewCards());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    cards,
    loading,
    refresh,
    create: async (card: Partial<ReviewCard>) => createReviewCard(card),
    rate: async (cardId: string, rating: number) => {
      await rateReviewCard({ cardId, rating });
      await refresh();
    },
  };
}
