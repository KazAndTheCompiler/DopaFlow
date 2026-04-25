/**
 * Shared TypeScript type definitions for DopaFlow
 * Used by both frontend and backend
 */

// Tasks
export type TaskId = string;

export interface Task {
  id: TaskId;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  done?: boolean;
  due_date?: string;
  due_at?: string;
  tags: string[];
  project_id?: string;
  time_logs?: TaskTimeLog[];
  created_at: string;
  updated_at: string;
}

export interface TaskTimeLog {
  id: string;
  task_id: TaskId;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
}

export interface TaskQuickAddPreview {
  title: string;
  priority: Task['priority'];
  due_date?: string;
  tags: string[];
  project_id?: string;
}

// Calendar
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  recurrence?: string;
  tags: string[];
  color?: string;
  created_at: string;
  updated_at: string;
}

// Habits
export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'custom';
  target_freq?: number;
  target_count: number;
  current_streak: number;
  longest_streak: number;
  today_count?: number;
  completed_dates: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Journal
export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  markdown_body?: string;
  body?: string;
  tags: string[];
  mood?: number;
  word_count: number;
  version?: number;
  locked?: boolean;
  created_at: string;
  updated_at: string;
}

// Focus Sessions
export interface FocusSession {
  id: string;
  task_id?: TaskId;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  interruptions: number;
  notes?: string;
  status?: 'active' | 'completed' | 'cancelled';
}

// Review Cards (Spaced Repetition)
export interface ReviewCard {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  difficulty: 'new' | 'learning' | 'review' | 'mastered';
  next_review_date: string;
  interval_days: number;
  reviews_done?: number;
  created_at: string;
  updated_at: string;
}

// Projects
export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  status: 'active' | 'archived' | 'completed';
  archived?: boolean;
  task_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
}

// Peer Feeds (Calendar Sharing)
export interface PeerFeed {
  id: string;
  name: string;
  url: string;
  color: string;
  last_sync_at?: string;
  sync_status: 'ok' | 'error' | 'pending';
  enabled: boolean;
}

// Sync
export interface SyncConflict {
  id: string;
  type: 'task' | 'event' | 'habit';
  local_data: unknown;
  remote_data: unknown;
  resolved_at?: string;
  created_at: string;
}

// Extended Alarm
export interface Alarm {
  id: string;
  time: string;
  at?: string;
  label?: string;
  title?: string;
  enabled: boolean;
  repeat_days?: number[];
  sound?: string;
}

// Notifications
export interface Notification {
  id: string;
  type: 'task_due' | 'habit_reminder' | 'focus_complete' | 'system';
  level?: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  data?: unknown;
  created_at: string;
}

// Gamification
export interface PlayerLevel {
  level: number;
  xp: number;
  xp_to_next: number;
  total_xp: number;
  title: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at?: string;
}

export interface MomentumScore {
  date: string;
  score: number;
  factors: {
    tasks_completed: number;
    focus_minutes: number;
    habits_done: number;
    journal_written: boolean;
  };
}

// Packy AI
export interface PackyWhisper {
  id: string;
  message: string;
  type: 'suggestion' | 'reminder' | 'insight';
  dismissed: boolean;
  created_at: string;
}

export interface PackyVoiceResponse {
  status: 'ok' | 'error' | 'needs_clarification' | 'pending';
  intent: string;
  confidence: number;
  tts_text?: string;
  reply_text: string;
  preview?: {
    title?: string;
    description?: string;
    tags?: string[];
    due_date?: string;
    priority?: Task['priority'];
  };
  execution_result?: {
    success: boolean;
    message?: string;
    data?: unknown;
  };
  follow_ups?: string[];
  entities?: Record<string, unknown>;
}

// Vault (Obsidian Integration)
export interface VaultStatus {
  connected: boolean;
  path?: string;
  last_sync_at?: string;
  file_count?: number;
}

export interface VaultConflictPreview {
  file_path: string;
  local_modified: string;
  remote_modified: string;
  preview: string;
}

export interface VaultFileRecord {
  path: string;
  content_hash: string;
  modified_at: string;
  synced_at?: string;
}

// App State
export interface AppState {
  current_route: string;
  sidebar_collapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
}

// API Types
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

// Extended Journal Entry
export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  markdown_body?: string;
  body?: string;
  tags: string[];
  mood?: number;
  word_count: number;
  version?: number;
  locked?: boolean;
  created_at: string;
  updated_at: string;
}

// Extended Habit
export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'custom';
  target_freq?: number;
  target_count: number;
  current_streak: number;
  longest_streak: number;
  today_count?: number;
  completed_dates: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Extended Review Card
export interface ReviewCard {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  difficulty: 'new' | 'learning' | 'review' | 'mastered';
  next_review_date: string;
  interval_days: number;
  reviews_done?: number;
  created_at: string;
  updated_at: string;
}

// Extended Project
export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  status: 'active' | 'archived' | 'completed';
  archived?: boolean;
  task_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
}

// Extended Notification
export interface Notification {
  id: string;
  type: 'task_due' | 'habit_reminder' | 'focus_complete' | 'system';
  level?: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  data?: unknown;
  created_at: string;
}

// Extended Alarm
export interface Alarm {
  id: string;
  time: string;
  at?: string;
  label?: string;
  enabled: boolean;
  repeat_days?: number[];
  sound?: string;
}

// Vault Types
export interface VaultConfig {
  path: string;
  auto_sync: boolean;
}

export interface VaultConfigUpdate {
  path?: string;
  auto_sync?: boolean;
}

export interface VaultPushResult {
  pushed: number;
  errors: string[];
}

export interface VaultPullResult {
  pulled: number;
  errors: string[];
}

export interface VaultRollbackResult {
  restored: boolean;
  timestamp: string;
}

export interface TaskImportPreview {
  tasks: TaskImportCandidate[];
}

export interface TaskImportCandidate {
  title: string;
  tags: string[];
  priority: Task['priority'];
  selected: boolean;
}

// Sharing Types
export interface ShareToken {
  id: string;
  token: string;
  name: string;
  expires_at?: string;
  created_at: string;
}

export interface ShareTokenCreated {
  token: string;
  url: string;
}

export interface PeerFeedSyncResult {
  status: 'ok' | 'error';
  events_added: number;
  errors: string[];
}

// Integrations
export interface IntegrationsStatus {
  obsidian: boolean;
  calendar: boolean;
  sync_enabled: boolean;
}

// Packy Types
export interface PackyVoiceResponse {
  text: string;
  audio_url?: string;
  emotion?: 'neutral' | 'excited' | 'calm' | 'urgent';
}
