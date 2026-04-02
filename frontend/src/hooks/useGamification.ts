import { useCallback, useEffect, useRef, useState } from "react";

import type { Badge, PlayerLevel } from "../../../shared/types/gamification";
import { getGamificationStatus } from "@api/gamification";

export interface UseGamificationResult {
  level: PlayerLevel | undefined;
  badges: Badge[];
  earnedCount: number;
  newBadge: Badge | null;
  dismissNewBadge: () => void;
  refresh: () => Promise<void>;
}

export function useGamification(onBadgeEarned?: (badge: Badge) => void): UseGamificationResult {
  const [level, setLevel] = useState<PlayerLevel>();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedCount, setEarnedCount] = useState<number>(0);
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  const earnedRef = useRef<number>(0);
  const earnedIdsRef = useRef<Set<string>>(new Set());
  const onBadgeEarnedRef = useRef<typeof onBadgeEarned>(onBadgeEarned);

  useEffect(() => {
    onBadgeEarnedRef.current = onBadgeEarned;
  }, [onBadgeEarned]);

  const refresh = useCallback(async (): Promise<void> => {
    const status = await getGamificationStatus();
    const nextEarnedIds = new Set(status.badges.filter((badge) => badge.earned_at).map((badge) => badge.id));
    if (status.earned_count > earnedRef.current) {
      const earnedBadge = status.badges.find((badge) => badge.earned_at && !earnedIdsRef.current.has(badge.id)) ?? null;
      if (earnedBadge) {
        setNewBadge(earnedBadge);
        onBadgeEarnedRef.current?.(earnedBadge);
      }
    }
    earnedRef.current = status.earned_count;
    earnedIdsRef.current = nextEarnedIds;
    setLevel(status.level);
    setBadges(status.badges);
    setEarnedCount(status.earned_count);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { level, badges, earnedCount, newBadge, dismissNewBadge: () => setNewBadge(null), refresh };
}
