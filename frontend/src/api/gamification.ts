import type { Badge, PlayerLevel } from "../../../shared/types/gamification";
import { apiClient } from "./client";

export interface GamificationStatus {
  level: PlayerLevel;
  badges: Badge[];
  earned_count: number;
}

export function getGamificationStatus(): Promise<GamificationStatus> {
  return apiClient<GamificationStatus>("/gamification/status");
}
