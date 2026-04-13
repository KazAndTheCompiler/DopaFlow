import type { JSX } from 'react';

import type { Task } from '../../../../shared/types';

export function CalendarDaySidebar({
  isNarrowCalendarLayout,
  prefillHour,
  prefillTitle,
  blockStartTime,
  blockDurationHours,
  blockDurationMinutes,
  blockReminder,
  blockReminderOffset,
  pendingTasks,
  onSetPrefillTitle,
  onSetBlockStartTime,
  onSetBlockDurationHours,
  onSetBlockDurationMinutes,
  onSetBlockReminder,
  onSetBlockReminderOffset,
  onSubmitDayBlock,
  onClearBlockDraft,
  onScheduleTask,
}: {
  isNarrowCalendarLayout: boolean;
  prefillHour: number | null;
  prefillTitle: string;
  blockStartTime: string;
  blockDurationHours: number;
  blockDurationMinutes: number;
  blockReminder: boolean;
  blockReminderOffset: number;
  pendingTasks: Task[];
  onSetPrefillTitle: (value: string) => void;
  onSetBlockStartTime: (value: string) => void;
  onSetBlockDurationHours: (value: number) => void;
  onSetBlockDurationMinutes: (value: number) => void;
  onSetBlockReminder: (value: boolean) => void;
  onSetBlockReminderOffset: (value: number) => void;
  onSubmitDayBlock: () => void;
  onClearBlockDraft: () => void;
  onScheduleTask: (taskTitle: string, hour: number) => void;
}): JSX.Element {
  const totalDurationMinutes = Math.max(1, blockDurationHours * 60 + blockDurationMinutes);

  return (
    <div style={{ display: 'grid', gap: '0.75rem', minWidth: 0 }}>
      <div
        style={{
          padding: '1rem',
          borderRadius: '16px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          display: 'grid',
          gap: '0.65rem',
        }}
      >
        <strong style={{ fontSize: 'var(--text-sm)' }}>
          {prefillHour !== null ? `Block ${String(prefillHour).padStart(2, '0')}:00` : 'Time block'}
        </strong>
        <input
          value={prefillTitle}
          onChange={(event) => onSetPrefillTitle(event.target.value)}
          placeholder="What are you blocking time for?"
          style={{
            padding: '0.5rem 0.65rem',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-2, var(--surface))',
            color: 'var(--text)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'inherit',
            width: '100%',
            boxSizing: 'border-box',
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && prefillTitle.trim()) {
              onSubmitDayBlock();
            }
          }}
        />
        {prefillHour === null && (
          <p
            style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}
          >
            Click any hour slot on the calendar to pick a time.
          </p>
        )}
        {prefillHour !== null && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isNarrowCalendarLayout
                  ? '1fr'
                  : 'minmax(120px, 0.9fr) minmax(0, 1.1fr)',
                gap: '0.55rem',
                alignItems: 'end',
              }}
            >
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Start
                </label>
                <input
                  type="time"
                  value={blockStartTime}
                  onChange={(event) => onSetBlockStartTime(event.target.value)}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-2, var(--surface))',
                    color: 'var(--text)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Duration
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '0.45rem',
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    value={blockDurationHours}
                    onChange={(event) =>
                      onSetBlockDurationHours(Math.max(0, Number(event.target.value) || 0))
                    }
                    placeholder="Hours"
                    aria-label="Block duration hours"
                    style={{
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-2, var(--surface))',
                      color: 'var(--text)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    value={blockDurationMinutes}
                    onChange={(event) =>
                      onSetBlockDurationMinutes(Math.max(0, Number(event.target.value) || 0))
                    }
                    placeholder="Minutes"
                    aria-label="Block duration minutes"
                    style={{
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-2, var(--surface))',
                      color: 'var(--text)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
              Total duration: {totalDurationMinutes} minute{totalDurationMinutes === 1 ? '' : 's'}
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: '0.25rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={blockReminder}
                  onChange={(event) => onSetBlockReminder(event.target.checked)}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                Remind me
              </label>
              {blockReminder && (
                <select
                  value={blockReminderOffset}
                  onChange={(event) => onSetBlockReminderOffset(Number(event.target.value))}
                  style={{
                    padding: '0.3rem 0.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-2, var(--surface))',
                    color: 'var(--text)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value={5}>5 min before</option>
                  <option value={15}>15 min before</option>
                  <option value={30}>30 min before</option>
                  <option value={60}>1 hour before</option>
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                disabled={!prefillTitle.trim()}
                onClick={onSubmitDayBlock}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: prefillTitle.trim() ? 'var(--accent)' : 'var(--border-subtle)',
                  color: 'var(--text-inverted)',
                  cursor: prefillTitle.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                }}
              >
                Block it
              </button>
              <button
                onClick={onClearBlockDraft}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                X
              </button>
            </div>
          </>
        )}
      </div>

      {pendingTasks.length > 0 && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '16px',
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <span
            style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}
          >
            Schedule a task
          </span>
          <div style={{ display: 'grid', gap: '0.35rem', maxHeight: '320px', overflowY: 'auto' }}>
            {pendingTasks.slice(0, 20).map((task) => (
              <div
                key={task.id}
                onClick={() => {
                  const hour = prefillHour ?? new Date().getHours() + 1;
                  onScheduleTask(task.title, hour);
                }}
                style={{
                  padding: '0.45rem 0.6rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-2, var(--surface))',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'center',
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    const hour = prefillHour ?? new Date().getHours() + 1;
                    onScheduleTask(task.title, hour);
                  }
                }}
              >
                <span
                  style={{
                    padding: '0.16rem 0.42rem',
                    borderRadius: '999px',
                    background: task.priority <= 2 ? 'var(--state-warn)16' : 'var(--surface)',
                    color: task.priority <= 2 ? 'var(--state-warn)' : 'var(--text-secondary)',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  P{task.priority}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
