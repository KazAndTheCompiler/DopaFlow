/** Shared DopaFlow type contracts used across frontend and desktop surfaces. */

export type SkinId =
  | "ink-and-stone"
  | "warm-analog"
  | "paper-minimal"
  | "aurora"
  | "soft-pastel"
  | "cotton-candy"
  | "high-contrast"
  | "midnight-neon"
  | "amber-terminal"
  | "glassy-modern"
  | "lush-forest"
  | "vampire-romance"
  | "deep-ocean"
  | "sunset-blues"
  | "classic-noir"
  | "neon-punk"
  | "forest-gradient"
  | "ocean-gradient"
  | "amber-night"
  | (string & Record<never, never>); // allow custom skins from skinmaker

export type TaskId = `tsk_${string}`;
export type HabitId = `hab_${string}`;
export type FocusId = `foc_${string}`;
export type ReviewId = `rev_${string}`;
export type JournalId = `jrn_${string}`;
export type EventId = `evt_${string}`;
export type BlockId = `blk_${string}`;
export type ReminderId = `rem_${string}`;
export type NotificationId = `ntf_${string}`;
export type CommandId = `cmd_${string}`;
export type AlarmId = `alm_${string}`;
export type ProjectId = `prj_${string}`;

export interface Project {
  id: ProjectId;
  name: string;
  color: string;
  icon: string;
  archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubTask {
  id: TaskId;
  title: string;
  done: boolean;
}

export interface Task {
  id: TaskId;
  title: string;
  description?: string | null;
  due_at?: string | null;
  priority: number;
  status: "todo" | "in_progress" | "done" | "cancelled";
  done: boolean;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  recurrence_rule?: string | null;
  recurrence_parent_id?: TaskId | null;
  sort_order: number;
  subtasks: SubTask[];
  tags: string[];
  source_type?: string | null;
  source_external_id?: string | null;
  source_instance_id?: string | null;
  project_id?: ProjectId | null;
  dependencies: TaskDependency[];
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  id: string;
  title: string;
}

export interface TaskTimeLog {
  id: string;
  task_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_m: number | null;
}

export interface TaskQuickAddPreview {
  title?: string;
  due_at?: string | null;
  priority?: number;
  tags?: string[];
  estimated_minutes?: number | null;
  recurrence_rule?: string | null;
  ambiguity?: boolean | null;
  ambiguity_hints?: string[];
  /** Legacy parser field still emitted by some preview/voice paths. */
  rrule?: string | null;
}

export interface Habit {
  id: HabitId;
  name: string;
  target_freq: number;
  target_period: string;
  color: string;
  description?: string | null;
  freeze_until?: string | null;
  current_streak: number;
  best_streak: number;
  last_checkin_date?: string | null;
  completion_pct?: number;
  completion_count?: number;
  today_count?: number;
  created_at?: string;
  deleted_at?: string | null;
  progress?: number;
  /** @deprecated use current_streak */
  streak_days?: number;
}

export interface FocusSession {
  id: FocusId;
  task_id?: TaskId | null;
  started_at: string;
  ended_at?: string | null;
  duration_minutes: number;
  status: string;
  paused_duration_ms?: number;
  task_title?: string | null;
}

export interface ReviewCard {
  id: ReviewId;
  deck_id: string;
  front: string;
  back: string;
  interval: number;
  ease_factor: number;
  next_review_at?: string | null;
  last_rating?: number | null;
  lapse_count: number;
  reviews_done: number;
}

export interface JournalEntry {
  id: JournalId;
  markdown_body: string;
  emoji?: string | null;
  date: string;
  tags: string[];
  version: number;
  locked?: boolean;
  auto_tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SyncConflict {
  id: number;
  object_id: string;
  object_type: string;
  conflict_reason: string;
  local_snapshot: Record<string, unknown> | null;
  incoming_snapshot: Record<string, unknown> | null;
  field_diffs: Record<string, unknown> | null;
  owner: string | null;
  source_context: string | null;
  repair_hint: string | null;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface CalendarEvent {
  id: EventId;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  category?: string | null;
  recurrence?: string | null;
  source_type?: string | null;
  source_external_id?: string | null;
  source_instance_id?: string | null;
  source_origin_app?: string | null;
  sync_status: "local_only" | "pending_sync" | "synced" | "conflict" | "error";
  provider_readonly: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alarm {
  id: AlarmId;
  at: string;
  title: string;
  kind: string;
  tts_text?: string | null;
  youtube_link?: string | null;
  muted?: boolean;
  last_fired_at?: string | null;
}

export interface Notification {
  id: NotificationId;
  level: "alarm" | "habit" | "insight" | "system" | "warn" | "info";
  title: string;
  body?: string | null;
  read: boolean;
  archived: boolean;
  created_at: string;
  action_url?: string | null;
}

export interface PackyWhisper {
  text: string;
  tone: "neutral" | "helpful" | "positive";
  suggested_action?: string | null;
}

// VoiceCommandPreview — kept for potential server-STT preview UI (currently unused)
// interface VoiceCommandPreview {
//   transcript: string;
//   status: string;
//   command_word: string | null;
//   parsed: Record<string, unknown>;
//   preview: Record<string, unknown>;
// }

export type PackyVoiceMode = "preview" | "executed" | "clarification" | "conversational" | "empty";

export interface PackyVoiceResponse {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  preview: Record<string, unknown>;
  execution_result: Record<string, unknown> | null;
  reply_text: string;
  tts_text: string;
  follow_ups: string[];
  status: string;
  mode: PackyVoiceMode;
}

export interface MomentumScore {
  score: number;
  delta_vs_yesterday: number;
  components: Record<string, number>;
  level: "low" | "building" | "flowing" | "peak";
  summary: string;
}

export type { XPEvent, PlayerLevel, Badge, BadgeId } from "./gamification";

export interface ShareToken {
  id: string;
  label: string;
  scopes: string;
  allow_write: boolean;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ShareTokenCreated extends ShareToken {
  raw_token: string;
}

export interface PeerFeed {
  id: string;
  label: string;
  base_url: string;
  color: string;
  sync_status: "idle" | "syncing" | "ok" | "error";
  allow_write: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface PeerFeedSyncResult {
  feed_id: string;
  events_imported: number;
  conflicts: number;
  status: string;
  detail?: string | null;
}

export interface IntegrationsStatus {
  gmail_status: string;
  gmail_connected: boolean;
  webhooks_enabled: boolean;
  webhook_pending: number;
  webhook_retry_wait: number;
  webhook_sent: number;
}

export interface VaultConfig {
  vault_enabled: boolean;
  vault_path: string;
  daily_note_folder: string;
  tasks_folder: string;
  review_folder: string;
  projects_folder: string;
  attachments_folder: string;
}

export type VaultConfigUpdate = Partial<VaultConfig>;

export interface VaultFileRecord {
  id: number;
  entity_type: string;
  entity_id: string;
  file_path: string;
  file_hash: string | null;
  last_synced_at: string | null;
  last_direction: string | null;
  sync_status: "idle" | "conflict" | "error";
  created_at: string;
}

export interface VaultPushResult {
  pushed: number;
  skipped: number;
  conflicts: number;
  errors: string[];
}

export interface VaultPullResult {
  imported: number;
  updated: number;
  conflicts: number;
  errors: string[];
}

export interface VaultRollbackResult {
  rolled_back: boolean;
  file_path: string;
  message: string;
}

export interface VaultStatus {
  config: VaultConfig;
  vault_reachable: boolean;
  total_indexed: number;
  conflicts: number;
  last_push_at: string | null;
  last_pull_at: string | null;
}

export interface VaultConflictPreview {
  record: VaultFileRecord;
  snapshot_body: string | null;
  current_body: string | null;
  current_exists: boolean;
  diff_lines: string[];
}

export interface TaskImportCandidate {
  title: string;
  done: boolean;
  due_str: string | null;
  priority: number;
  tags: string[];
  file_path: string;
  line_text: string;
  line_number: number | null;
  project_id: string | null;
  project_name: string | null;
  status: "importable" | "known" | "skipped";
  known_task_id: string | null;
}

export interface TaskImportPreview {
  importable: TaskImportCandidate[];
  known: TaskImportCandidate[];
  skipped: number;
  total_scanned: number;
}

export interface TaskImportConfirmRequest {
  candidates: TaskImportCandidate[];
}
