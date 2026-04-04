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

const EMPTY_LEVEL: PlayerLevel = {
  total_xp: 0,
  level: 1,
  xp_to_next: 100,
  progress: 0,
  updated_at: new Date(0).toISOString(),
};

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
    const badges = Array.isArray(status.badges) ? status.badges : [];
    const earnedCount = typeof status.earned_count === "number" ? status.earned_count : 0;
    const nextEarnedIds = new Set(badges.filter((badge) => badge.earned_at).map((badge) => badge.id));

    if (earnedCount > earnedRef.current) {
      const earnedBadge = badges.find((badge) => badge.earned_at && !earnedIdsRef.current.has(badge.id)) ?? null;
      if (earnedBadge) {
        setNewBadge(earnedBadge);
        onBadgeEarnedRef.current?.(earnedBadge);
      }
    }
    earnedRef.current = earnedCount;
    earnedIdsRef.current = nextEarnedIds;
    setLevel(status.level ?? EMPTY_LEVEL);
    setBadges(badges);
    setEarnedCount(earnedCount);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { level, badges, earnedCount, newBadge, dismissNewBadge: () => setNewBadge(null), refresh };
}
