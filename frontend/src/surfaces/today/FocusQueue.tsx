import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';

import type { CalendarEvent, FocusSession, Habit, Task } from '../../../../shared/types';
import { localDateISO } from '../../app/AppShared';

export interface FocusQueueProps {
  tasks: Task[];
  habits?: Habit[];
  events?: CalendarEvent[];
  activeSession?: FocusSession | undefined;
  onStartFocus: (taskId: string, durationMinutes?: number) => void;
  onComplete: (taskId: string) => void;
  onEdit?: (task: Task) => void;
  onHabitCheckIn?: (habitId: string) => void;
}

type QueueItem =
  | { kind: 'task'; data: Task; priority: number }
  | { kind: 'habit'; data: Habit; priority: number }
  | { kind: 'event'; data: CalendarEvent; priority: number };

type TaskId = Task['id'];

const QUEUE_SOFT_LIMIT = 5;
const QUEUE_WARN_AT = 6;
const FOCUS_QUEUE_ORDER_PREFIX = 'dopaflow:focus_queue_order_';
const FOCUS_QUEUE_REORDER_TYPE = 'application/x-dopaflow-focus-queue-id';
const FOCUS_QUEUE_RETENTION_DAYS = 2;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function scoreTask(task: Task): number {
  const now = Date.now();
  if (!task.done && task.due_at) {
    const due = new Date(task.due_at).getTime();
    if (due < now) return 1;
    if (due - now < 24 * 60 * 60 * 1000) return 1;
    if (due - now < 7 * 24 * 60 * 60 * 1000) return 2;
  }
  if (!task.done) return 3;
  return 4;
}

function scoreHabit(habit: Habit): number {
  const count = habit.today_count ?? 0;
  const target = habit.target_freq;
  if (count >= target) return 4;
  if (target > 0 && count < target * 0.5) return 2;
  return 3;
}

function scoreEvent(event: CalendarEvent): number {
  const now = Date.now();
  const start = new Date(event.start_at).getTime();
  const diff = start - now;
  if (diff < TWO_HOURS_MS && diff > -60 * 60 * 1000) return 1;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (start >= todayStart.getTime() && start < todayStart.getTime() + 24 * 60 * 60 * 1000)
    return 2;
  return 3;
}

function buildUnifiedQueue(
  tasks: Task[],
  habits: Habit[],
  events: CalendarEvent[],
): QueueItem[] {
  const items: QueueItem[] = [];
  for (const task of tasks) {
    if (!task.done) items.push({ kind: 'task', data: task, priority: scoreTask(task) });
  }
  for (const habit of habits) {
    items.push({ kind: 'habit', data: habit, priority: scoreHabit(habit) });
  }
  for (const event of events) {
    if (!event.all_day)
      items.push({ kind: 'event', data: event, priority: scoreEvent(event) });
  }
  return items.sort((a, b) => a.priority - b.priority);
}

function defaultTaskSort(left: Task, right: Task): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  const leftDue = left.due_at ? new Date(left.due_at).getTime() : Number.POSITIVE_INFINITY;
  const rightDue = right.due_at ? new Date(right.due_at).getTime() : Number.POSITIVE_INFINITY;
  return leftDue - rightDue;
}

function arraysEqual(left: TaskId[], right: TaskId[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function moveItem(ids: TaskId[], sourceId: TaskId, targetId: TaskId): TaskId[] {
  if (sourceId === targetId) {
    return ids;
  }
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) {
    return ids;
  }
  const next = [...ids];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function pruneStoredQueueOrders(todayISO: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const cutoff = localDateISO(-FOCUS_QUEUE_RETENTION_DAYS);
  for (const key of Object.keys(window.localStorage)) {
    if (!key.startsWith(FOCUS_QUEUE_ORDER_PREFIX)) {
      continue;
    }
    const dateText = key.slice(FOCUS_QUEUE_ORDER_PREFIX.length);
    if (!dateText || dateText < cutoff || dateText > todayISO) {
      window.localStorage.removeItem(key);
    }
  }
}

function readStoredQueueOrder(storageKey: string): TaskId[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const storedOrder = window.localStorage.getItem(storageKey);
  if (!storedOrder) {
    return [];
  }
  try {
    const parsed = JSON.parse(storedOrder) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
      return parsed as TaskId[];
    }
  } catch {
    window.localStorage.removeItem(storageKey);
  }
  return [];
}

function priorityDot(priority: number): JSX.Element {
  const color =
    priority === 1
      ? 'var(--state-overdue)'
      : priority === 2
        ? 'var(--state-warn)'
        : priority === 3
          ? 'var(--state-completed)'
          : 'var(--text-muted)';
  return (
    <span
      aria-hidden="true"
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        marginTop: '2px',
      }}
    />
  );
}

function typeBadge(kind: 'task' | 'habit' | 'event'): JSX.Element {
  const label = kind === 'task' ? 'T' : kind === 'habit' ? 'H' : 'E';
  const bg =
    kind === 'task'
      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
      : kind === 'habit'
        ? 'color-mix(in srgb, var(--state-completed) 12%, transparent)'
        : 'color-mix(in srgb, var(--state-warn) 12%, transparent)';
  const color =
    kind === 'task'
      ? 'var(--accent)'
      : kind === 'habit'
        ? 'var(--state-completed)'
        : 'var(--state-warn)';
  return (
    <span
      style={{
        padding: '0.1rem 0.35rem',
        borderRadius: '4px',
        background: bg,
        color,
        fontSize: '0.6rem',
        fontWeight: 800,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

export function FocusQueue({
  tasks,
  habits = [],
  events = [],
  activeSession,
  onStartFocus,
  onComplete,
  onEdit,
  onHabitCheckIn,
}: FocusQueueProps): JSX.Element {
  const todayISO = localDateISO();
  const storageKey = `${FOCUS_QUEUE_ORDER_PREFIX}${todayISO}`;
  const pending = tasks.filter((t) => !t.done);
  const [orderedTaskIds, setOrderedTaskIds] = useState<TaskId[]>([]);

  const unifiedQueue = useMemo(
    () => buildUnifiedQueue(tasks, habits, events),
    [tasks, habits, events],
  );

  useEffect(() => {
    pruneStoredQueueOrders(todayISO);
    setOrderedTaskIds(readStoredQueueOrder(storageKey));
  }, [storageKey, todayISO]);

  useEffect(() => {
    const pendingIds = new Set(pending.map((task) => task.id));
    setOrderedTaskIds((current) => {
      const next = current.filter((id) => pendingIds.has(id));
      if (typeof window !== 'undefined' && !arraysEqual(current, next)) {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return arraysEqual(current, next) ? current : next;
    });
  }, [pending, storageKey]);

  const orderedPending = useMemo(() => {
    const orderIndex = new Map(orderedTaskIds.map((id, index) => [id, index]));
    return [...pending].sort((left, right) => {
      const leftIndex = orderIndex.get(left.id);
      const rightIndex = orderIndex.get(right.id);
      if (
        (leftIndex !== null && leftIndex !== undefined) ||
        (rightIndex !== null && rightIndex !== undefined)
      ) {
        if (leftIndex === null || leftIndex === undefined) {
          return 1;
        }
        if (rightIndex === null || rightIndex === undefined) {
          return -1;
        }
        return leftIndex - rightIndex;
      }
      return defaultTaskSort(left, right);
    });
  }, [orderedTaskIds, pending]);

  const queue = unifiedQueue.slice(0, QUEUE_SOFT_LIMIT);

  const totalItems = unifiedQueue.length;
  const hiddenCount = Math.max(0, totalItems - QUEUE_SOFT_LIMIT);
  const isOverfull = totalItems >= QUEUE_WARN_AT;
  const hasActiveSession = Boolean(activeSession);

  const saveOrder = (ids: TaskId[]): void => {
    setOrderedTaskIds(ids);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(ids));
    }
  };

  const onQueueDrop = (event: DragEvent<HTMLDivElement>, targetId: TaskId): void => {
    const sourceId = event.dataTransfer.getData(FOCUS_QUEUE_REORDER_TYPE) as TaskId;
    if (!sourceId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const queueIds = orderedPending.map((task) => task.id);
    const nextIds = moveItem(queueIds, sourceId, targetId);
    if (!arraysEqual(nextIds, queueIds)) {
      saveOrder(nextIds);
    }
  };

  return (
    <section
      style={{
        padding: '1.1rem 1.15rem',
        borderRadius: '20px',
        background: 'var(--card-gradient, color-mix(in srgb, var(--surface) 92%, transparent))',
        backdropFilter: 'var(--surface-glass-blur, blur(14px))',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        gap: '0.85rem',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '8%',
          right: '8%',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, var(--surface-edge-light, rgba(255,255,255,0.1)), transparent)',
          pointerEvents: 'none',
          borderRadius: '1px',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--surface-inner-light)',
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '35%',
          background: 'var(--surface-inner-highlight)',
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--surface-specular)',
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <strong style={{ fontSize: 'var(--text-base)' }}>Focus Queue</strong>
        <span
          style={{
            padding: '0.15rem 0.55rem',
            borderRadius: '999px',
            background: isOverfull
              ? 'color-mix(in srgb, var(--state-warn) 15%, transparent)'
              : 'var(--surface-2)',
            border: isOverfull
              ? '1px solid color-mix(in srgb, var(--state-warn) 35%, transparent)'
              : '1px solid transparent',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            color: isOverfull ? 'var(--state-warn)' : 'var(--text-secondary)',
          }}
        >
          {queue.length}
          {hiddenCount > 0 ? ` of ${totalItems}` : ''}
        </span>
      </div>

      {/* Resume banner */}
      {hasActiveSession && (
        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '14px',
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1rem', color: 'var(--accent)', flexShrink: 0 }}>&#9654;</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block' }}>
              Session in progress
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Pick up where you left off — open Focus to resume or finish.
            </span>
          </div>
          <button
            onClick={() => {
              window.location.hash = '#/focus';
            }}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--text-inverted)',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Resume
          </button>
        </div>
      )}

      {/* Overfull nudge */}
      {isOverfull && (
        <div
          style={{
            padding: '0.6rem 0.85rem',
            borderRadius: '12px',
            background: 'color-mix(in srgb, var(--state-warn) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--state-warn) 22%, transparent)',
            fontSize: 'var(--text-xs)',
            color: 'var(--state-warn)',
            fontWeight: 600,
          }}
        >
          {totalItems} items queued — a shorter list keeps execution sharper. Consider trimming to
          3–5.
        </div>
      )}

      {/* Empty state */}
      {queue.length === 0 ? (
        <div
          style={{
            padding: '1.5rem 1rem',
            borderRadius: '16px',
            background: 'var(--surface-2)',
            border: '1px dashed var(--border-subtle)',
            display: 'grid',
            gap: '0.4rem',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>&mdash;</span>
          <strong style={{ fontSize: 'var(--text-sm)' }}>Nothing queued yet</strong>
          <span
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}
          >
            Drag a task here from the backlog, or open Today to choose your first move.
          </span>
        </div>
      ) : (
        <>
          {queue.map((item) => {
            if (item.kind === 'task') {
              const task = item.data;
              const dueDate = task.due_at ? new Date(task.due_at) : null;
              const overdue = dueDate !== null && dueDate.getTime() < Date.now();
              const isActive = activeSession?.task_id === task.id;

              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData(FOCUS_QUEUE_REORDER_TYPE, task.id);
                  }}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes(FOCUS_QUEUE_REORDER_TYPE)) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(event) => onQueueDrop(event, task.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '14px',
                    background: 'var(--surface-2)',
                    border: '1px solid transparent',
                    transition: 'background 150ms ease',
                    cursor: 'grab',
                  }}
                >
                  {priorityDot(item.priority)}
                  {typeBadge('task')}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'grid',
                      gap: '0.1rem',
                      cursor: onEdit ? 'pointer' : 'inherit',
                    }}
                    onClick={() => onEdit?.(task)}
                    role={onEdit ? 'button' : undefined}
                    tabIndex={onEdit ? 0 : undefined}
                    onKeyDown={onEdit ? (e) => e.key === 'Enter' && onEdit(task) : undefined}
                  >
                    <span
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: item.priority <= 2 ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.title}
                    </span>
                    {overdue && dueDate && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--state-overdue)' }}>
                        Overdue &middot;{' '}
                        {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <button
                    disabled={isActive}
                    onClick={() => onStartFocus(task.id)}
                    aria-label={
                      isActive
                        ? `${task.title} — session active`
                        : `Start focus session for ${task.title}`
                    }
                    style={{
                      padding: '0.3rem 0.8rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: isActive
                        ? 'var(--surface-2)'
                        : item.priority <= 1
                          ? 'var(--accent)'
                          : 'color-mix(in srgb, var(--accent) 15%, transparent)',
                      color: isActive
                        ? 'var(--text-secondary)'
                        : item.priority <= 1
                          ? 'var(--text-inverted)'
                          : 'var(--accent)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      cursor: isActive ? 'default' : 'pointer',
                      transition: 'background 150ms ease',
                      flexShrink: 0,
                    }}
                  >
                    {isActive ? 'Active' : 'Focus'}
                  </button>
                  <button
                    onClick={() => onComplete(task.id)}
                    aria-label={`Mark ${task.title} complete`}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      lineHeight: 1,
                      color: 'var(--state-completed)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    &#10003;
                  </button>
                </div>
              );
            }

            if (item.kind === 'habit') {
              const habit = item.data;
              const count = habit.today_count ?? 0;
              const target = habit.target_freq;
              const done = count >= target;

              return (
                <div
                  key={habit.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '14px',
                    background: done
                      ? 'color-mix(in srgb, var(--state-completed) 6%, transparent)'
                      : 'var(--surface-2)',
                    border: done
                      ? '1px solid color-mix(in srgb, var(--state-completed) 20%, transparent)'
                      : '1px solid transparent',
                    transition: 'background 150ms ease',
                  }}
                >
                  {priorityDot(item.priority)}
                  {typeBadge('habit')}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 'var(--text-sm)',
                      fontWeight: item.priority <= 2 ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      opacity: done ? 0.65 : 1,
                    }}
                  >
                    {habit.name}
                    {target > 1 && (
                      <span
                        style={{
                          marginLeft: '0.35rem',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                        }}
                      >
                        {count}/{target}
                      </span>
                    )}
                  </span>
                  {habit.current_streak > 0 && (
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        color: done ? 'var(--state-completed)' : 'var(--text-muted)',
                      }}
                    >
                      {habit.current_streak}d
                    </span>
                  )}
                  {!done && onHabitCheckIn && (
                    <button
                      onClick={() => onHabitCheckIn(habit.id)}
                      aria-label={`Check in ${habit.name}`}
                      style={{
                        padding: '0.3rem 0.8rem',
                        borderRadius: '8px',
                        border: '1px solid var(--state-completed)',
                        background: 'transparent',
                        color: 'var(--state-completed)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      +1
                    </button>
                  )}
                </div>
              );
            }

            // event
            const event = item.data;
            const start = new Date(event.start_at);
            const timeStr = start.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 0.8rem',
                  borderRadius: '14px',
                  background: 'var(--surface-2)',
                  border: '1px solid transparent',
                  transition: 'background 150ms ease',
                }}
              >
                {priorityDot(item.priority)}
                {typeBadge('event')}
                <span
                  style={{
                    flex: 1,
                    fontSize: 'var(--text-sm)',
                    fontWeight: item.priority <= 2 ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.title}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {timeStr}
                </span>
                {event.alarm_id && (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent)',
                      flexShrink: 0,
                    }}
                    title="TTS reminder set"
                  >
                    &#128276;
                  </span>
                )}
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <button
              onClick={() => {
                window.location.hash = '#/tasks';
              }}
              style={{
                padding: '0.45rem 0.8rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              +{hiddenCount} more in queue — open Tasks to view all
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default FocusQueue;