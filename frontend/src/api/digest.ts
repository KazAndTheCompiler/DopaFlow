import { apiClient } from "./client";

export interface DigestTagCount {
  tag: string;
  count: number;
}

export interface DigestTaskSummary {
  completed: number;
  created: number;
  overdue: number;
  completion_rate: number;
  top_tags: DigestTagCount[];
}

export interface DigestHabitSummaryItem {
  name: string;
  done: number;
  rate: number;
}

export interface DigestHabitSummary {
  overall_rate: number;
  by_habit: DigestHabitSummaryItem[];
  best_habit: string;
  worst_habit: string;
}

export interface DigestFocusSummary {
  total_sessions: number;
  total_minutes: number;
  completion_rate: number;
  best_day: string;
}

export interface DigestJournalSummary {
  entries_written: number;
  avg_word_count: number;
  top_tags: DigestTagCount[];
  mood_distribution: Record<string, number>;
}

export interface DigestNutritionSummary {
  total_kcal: number;
  avg_kcal: number;
  days_logged: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export interface DigestCorrelation {
  type: string;
  description: string;
  confidence: string;
  habit_name?: string;
  metric?: string;
  pearson_r?: number;
  direction?: string;
  delta_pct?: number;
}

export interface DailyDigest {
  date: string;
  tasks: DigestTaskSummary;
  habits: DigestHabitSummary;
  focus: DigestFocusSummary;
  journal: DigestJournalSummary;
  momentum_score: number;
  momentum_label: string;
  score: number;
  tasks_completed_today: number;
  focus_minutes_today: number;
  habits_done_today: number;
  habit_total: number;
  nutrition: DigestNutritionSummary;
  correlations: DigestCorrelation[];
}

export interface WeeklyDigestReport {
  week_start: string;
  week_end: string;
  tasks: DigestTaskSummary;
  habits: DigestHabitSummary;
  focus: DigestFocusSummary;
  journal: DigestJournalSummary;
  nutrition: DigestNutritionSummary;
  correlations: DigestCorrelation[];
  momentum_score: number;
  momentum_label: string;
  score: number;
}

export function getDailyDigest(date?: string): Promise<DailyDigest> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiClient<DailyDigest>(`/digest/today${query}`);
}

export function getWeeklyDigestReport(weekStart?: string): Promise<WeeklyDigestReport> {
  const query = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : "";
  return apiClient<WeeklyDigestReport>(`/digest/week${query}`);
}
