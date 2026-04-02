import type { Badge, PlayerLevel } from "../../../shared/types/gamification";
import { apiClient } from "./client";

export function getGamificationStatus(): Promise<{ level: PlayerLevel; badges: Badge[]; earned_count: number }> {
  return apiClient<{ level: PlayerLevel; badges: Badge[]; earned_count: number }>("/gamification/status");
}
