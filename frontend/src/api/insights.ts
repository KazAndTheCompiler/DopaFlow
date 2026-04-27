import type { MomentumScore } from "../../../shared/types";
import { apiClient } from "./client";

export interface WeeklyDigest {
  title: string;
  highlights: string[];
}

export interface CorrelationInsight {
  metric: string;
  pearson_r?: number;
  interpretation: string;
}

export function getMomentum(): Promise<MomentumScore> {
  return apiClient<MomentumScore>("/insights/momentum");
}

export function getWeeklyDigest(): Promise<WeeklyDigest> {
  return apiClient<WeeklyDigest>("/insights/weekly-digest");
}

export function getCorrelations(): Promise<CorrelationInsight[]> {
  return apiClient<CorrelationInsight[]>("/insights/correlations");
}
