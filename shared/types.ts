/**
 * Shared TypeScript type definitions for DopaFlow
 * Used by both frontend and backend
 */

// Tasks
export type TaskId = string;
export type ProjectId = string;

export interface SubTask {
  id: string;
  title: string;
  completed?: boolean;
  done?: boolean;
}

export interface Task {
  id: TaskId;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'done' | 'archived' | 'cancelled' | 'todo';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  done?: boolean;
  due_date?: string;
  due_at?: string;
  estimated_minutes?: number;
  tags: string[];
  project_id?: string;
  time_logs?: TaskTimeLog[];
  subtasks?: SubTask[];
  recurrence_rule?: string;
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
  start_at?: string;  // Frontend alias
  end_at?: string;    // Frontend alias
  all_day: boolean;
  recurrence?: string;
  tags: string[];
  color?: string;
  category?: string;
  reminder_minutes?: number;
  provider_readonly?: boolean;
  alarm_id?: string;
  source_type?: string;
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
  target_period?: 'day' | 'week' | 'month' | string;
  current_streak: number;
  longest_streak: number;
  today_count?: number;
  completed_dates: string[];
  freeze_until?: string;
  completion_pct?: number;
  completion_count?: number;
  color?: string;
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
  emoji?: string;
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
  paused_duration_ms?: number;
  interruptions: number;
  notes?: string;
  status?: 'active' | 'completed' | 'cancelled' | 'running' | 'paused';
}

// Review Cards (Spaced Repetition)
export interface ReviewCard {
  id: string;
  question: string;
  answer: string;
  front?: string;  // Frontend alias
  back?: string;   // Frontend alias
  deck_id?: string;
  tags: string[];
  difficulty: 'new' | 'learning' | 'review' | 'mastered';
  next_review_date: string;
  next_review_at?: string;  // Frontend alias
  interval_days: number;
  interval?: number;  // Frontend alias
  ease_factor?: number;
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
  label?: string;
  url: string;
  base_url?: string;
  color: string;
  last_sync_at?: string;
  last_synced_at?: string | null;
  sync_status: 'ok' | 'error' | 'pending' | 'idle' | 'syncing';
  last_error?: string | null;
  enabled: boolean;
}

// Sync
export interface SyncConflict {
  id: string;
  type: 'task' | 'event' | 'habit';
  object_type?: string;
  object_id?: string;
  conflict_reason?: string;
  repair_hint?: string;
  detected_at?: string;
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
  // Frontend-specific properties
  kind?: 'standard' | 'tts' | 'youtube';
  muted?: boolean;
  tts_text?: string;
  youtube_link?: string;
  last_fired_at?: string;
}

// Notifications
export interface Notification {
  id: string;
  type: 'task_due' | 'habit_reminder' | 'focus_complete' | 'system';
  level?: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  body?: string;
  action_url?: string;
  read: boolean;
  data?: unknown;
  created_at: string;
}

// Gamification
export interface PlayerLevel {
  level: number;
  xp?: number;
  xp_to_next: number;
  total_xp: number;
  title?: string;
  progress?: number;
  updated_at?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at?: string;
  earned_at?: string;
  progress?: number;
}

export interface MomentumScore {
  date: string;
  score: number;
  level?: number;
  summary?: string;
  delta_vs_yesterday?: number;
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
  text?: string;
  type: 'suggestion' | 'reminder' | 'insight';
  dismissed: boolean;
  created_at: string;
}

export interface PackyVoiceResponse {
  status: 'ok' | 'error' | 'needs_clarification' | 'pending' | 'executed' | 'needs_datetime' | 'ambiguous' | 'not_found' | 'unsupported' | 'nothing_to_undo';
  intent: string;
  confidence: number;
  tts_text?: string;
  reply_text: string;
  reply?: string;
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
    reply?: string;
  };
  follow_ups?: string[];
  entities?: Record<string, unknown>;
  results?: PackyVoiceResponse[];
}

// Vault (Obsidian Integration)
export interface VaultConfig {
  vault_enabled?: boolean;
  vault_path?: string;
  daily_note_folder?: string;
  tasks_folder?: string;
}

export interface VaultStatus {
  connected: boolean;
  path?: string;
  last_sync_at?: string;
  file_count?: number;
  config?: VaultConfig;
  vault_reachable?: boolean;
  conflicts?: number;
  total_indexed?: number;
}

export interface VaultConflictPreview {
  file_path: string;
  local_modified: string;
  remote_modified: string;
  preview: string;
  diff_lines?: string[];
  current_exists?: boolean;
  current_body?: string;
  snapshot_body?: string;
}

export interface VaultFileRecord {
  path: string;
  content_hash: string;
  modified_at: string;
  synced_at?: string;
  id?: string;
  file_path?: string;
  entity_type?: string;
  entity_id?: string;
  last_direction?: 'push' | 'pull';
  last_synced_at?: string;
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

// Extended Journal Entry (merged with main definition above)

// Extended Habit (merged with main definition above)

// Extended Review Card (merged with main definition above)

// Extended Project (merged with main definition above)

// Extended Notification (merged with main definition above)

// Extended Alarm (merged with main definition above)

// Vault Types
export interface VaultConfig {
  path: string;
  auto_sync: boolean;
}

export interface VaultConfigUpdate {
  path?: string;
  auto_sync?: boolean;
  vault_enabled?: boolean;
  vault_path?: string;
}

export interface VaultPushResult {
  pushed: number;
  errors: string[];
  conflicts?: number;
}

export interface VaultPullResult {
  pulled: number;
  errors: string[];
  conflicts?: number;
  imported?: number;
}

export interface VaultRollbackResult {
  restored: boolean;
  timestamp: string;
  message?: string;
}

export interface TaskImportPreview {
  tasks: TaskImportCandidate[];
  importable?: TaskImportCandidate[];
  total_scanned?: number;
  known?: TaskImportCandidate[];
  skipped?: number;
}

export interface TaskImportCandidate {
  title: string;
  tags: string[];
  priority: Task['priority'];
  selected: boolean;
  due_str?: string;
  project_name?: string;
  file_path?: string;
}

// Sharing Types
export interface ShareToken {
  id: string;
  token: string;
  name: string;
  label?: string;
  expires_at?: string;
  created_at: string;
  last_used_at?: string;
}

export interface ShareTokenCreated {
  token: string;
  url: string;
  raw_token?: string;
  expires_at?: string;
}

export interface PeerFeedSyncResult {
  status: 'ok' | 'error';
  events_added: number;
  events_imported?: number;
  detail?: string;
  errors: string[];
}

// Integrations
export interface IntegrationsStatus {
  obsidian: boolean;
  calendar: boolean;
  sync_enabled: boolean;
  gmail_connected?: boolean;
  webhooks_enabled?: boolean;
  webhook_retry_wait?: number;
  webhook_pending?: number;
  webhook_sent?: number;
}

// Packy Types (merged with main PackyVoiceResponse definition above)
