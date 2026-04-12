import { ZodError, z } from "zod";

const taskDependencySchema = z.object({
  id: z.string(),
  title: z.string(),
});

const subTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
});

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: z.number(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]),
  done: z.boolean(),
  estimated_minutes: z.number().nullable().optional(),
  actual_minutes: z.number().nullable().optional(),
  recurrence_rule: z.string().nullable().optional(),
  recurrence_parent_id: z.string().nullable().optional(),
  sort_order: z.number(),
  subtasks: subTaskSchema.array(),
  tags: z.string().array(),
  source_type: z.string().nullable().optional(),
  source_external_id: z.string().nullable().optional(),
  source_instance_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  dependencies: taskDependencySchema.array(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const tasksSchema = taskSchema.array();

export const habitSchema = z.object({
  id: z.string(),
  name: z.string(),
  target_freq: z.number(),
  target_period: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
  freeze_until: z.string().nullable().optional(),
  current_streak: z.number(),
  best_streak: z.number(),
  last_checkin_date: z.string().nullable().optional(),
  completion_pct: z.number().optional(),
  completion_count: z.number().optional(),
  today_count: z.number().optional(),
  created_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
  progress: z.number().optional(),
  streak_days: z.number().optional(),
});
export const habitsSchema = habitSchema.array();

export const journalEntrySchema = z.object({
  id: z.string(),
  markdown_body: z.string(),
  emoji: z.string().nullable().optional(),
  date: z.string(),
  tags: z.string().array(),
  version: z.number(),
  locked: z.boolean().optional(),
  auto_tags: z.string().array().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export const journalEntriesSchema = journalEntrySchema.array();

export const calendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  start_at: z.string(),
  end_at: z.string(),
  all_day: z.boolean(),
  category: z.string().nullable().optional(),
  recurrence: z.string().nullable().optional(),
  source_type: z.string().nullable().optional(),
  source_external_id: z.string().nullable().optional(),
  source_instance_id: z.string().nullable().optional(),
  source_origin_app: z.string().nullable().optional(),
  sync_status: z.enum(["local_only", "pending_sync", "synced", "conflict", "error"]),
  provider_readonly: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const calendarEventsSchema = calendarEventSchema.array();

export const alarmRecordSchema = z.object({
  id: z.string(),
  at: z.string(),
  title: z.string(),
  kind: z.string(),
  tts_text: z.string().nullable().optional(),
  youtube_link: z.string().nullable().optional(),
  muted: z.boolean().optional(),
  last_fired_at: z.string().nullable().optional(),
});
export const alarmRecordsSchema = alarmRecordSchema.array();

export const focusSessionSchema = z.object({
  id: z.string(),
  task_id: z.string().nullable().optional(),
  started_at: z.string(),
  ended_at: z.string().nullable().optional(),
  duration_minutes: z.number(),
  status: z.string(),
  paused_duration_ms: z.number().optional(),
  task_title: z.string().nullable().optional(),
});
export const focusSessionsSchema = focusSessionSchema.array();

export const reviewCardSchema = z.object({
  id: z.string(),
  deck_id: z.string(),
  front: z.string(),
  back: z.string(),
  interval: z.number(),
  ease_factor: z.number(),
  next_review_at: z.string().nullable().optional(),
  last_rating: z.number().nullable().optional(),
  lapse_count: z.number(),
  reviews_done: z.number(),
});
export const reviewCardsSchema = reviewCardSchema.array();

export function parseApiSchema<T>(schema: z.ZodTypeAny, value: unknown): T {
  try {
    return schema.parse(value) as T;
  } catch (error) {
    if (error instanceof ZodError) {
      console.error("API schema validation failed", error);
      throw new Error(error.message);
    }
    throw error;
  }
}
