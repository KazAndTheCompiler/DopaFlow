export type BadgeId = string;

export interface XPEvent {
  source: "task_complete" | "habit_checkin" | "focus_session" | "review_card" | "journal_entry" | "streak_milestone";
  source_id?: string;
  xp: number;
  awarded_at: string;
}

export interface PlayerLevel {
  total_xp: number;
  level: number;
  xp_to_next: number;
  progress: number;
  updated_at: string;
}

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  earned_at?: string | null;
  progress: number;
  target: number;
}
