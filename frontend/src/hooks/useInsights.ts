import { useEffect, useState } from 'react';

import type { MomentumScore } from '../../../shared/types';
import { getCorrelations, getMomentum, getWeeklyDigest } from '@api/index';
import type { CorrelationInsight, WeeklyDigest } from '@api/insights';

export interface UseInsightsResult {
  momentum?: MomentumScore | undefined;
  weeklyDigest?: WeeklyDigest | undefined;
  correlations: CorrelationInsight[];
  refresh: () => Promise<void>;
}

export function useInsights(): UseInsightsResult {
  const [momentum, setMomentum] = useState<MomentumScore>();
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyDigest>();
  const [correlations, setCorrelations] = useState<CorrelationInsight[]>([]);

  const refresh = async (): Promise<void> => {
    const [nextMomentum, nextWeeklyDigest, nextCorrelations] = await Promise.all([
      getMomentum(),
      getWeeklyDigest(),
      getCorrelations(),
    ]);
    setMomentum(nextMomentum);
    setWeeklyDigest(
      nextWeeklyDigest && typeof nextWeeklyDigest.title === 'string'
        ? {
            title: nextWeeklyDigest.title,
            highlights: Array.isArray(nextWeeklyDigest.highlights)
              ? nextWeeklyDigest.highlights
              : [],
          }
        : undefined,
    );
    setCorrelations(Array.isArray(nextCorrelations) ? nextCorrelations : []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { momentum, weeklyDigest, correlations, refresh };
}
