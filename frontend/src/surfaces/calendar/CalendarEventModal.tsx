import { useEffect, useState } from 'react';

import Button from '@ds/primitives/Button';
import Modal from '@ds/primitives/Modal';
import type { CalendarEvent } from '../../../../shared/types';

export interface CalendarEventModalProps {
  event: CalendarEvent | null;
  sourceLabel?: string;
  sourceColor?: string;
  onClose: () => void;
  onSave: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CATEGORY_OPTIONS = [
  { label: 'Work', value: 'work' },
  { label: 'Personal', value: 'personal' },
  { label: 'Health', value: 'health' },
  { label: 'Focus', value: 'focus' },
];

const RECURRENCE_OPTIONS = [
  { label: 'Does not repeat', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Yearly', value: 'FREQ=YEARLY' },
];

function isoToDateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function isoToTimeInput(value: string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function CalendarEventModal({
  event,
  sourceLabel = 'Local',
  sourceColor = 'var(--accent)',
  onClose,
  onSave,
  onDelete,
}: CalendarEventModalProps): JSX.Element | null {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState('work');
  const [recurrence, setRecurrence] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!event) {
      return;
    }
    setTitle(event.title);
    setDescription(event.description ?? '');
    setDate(isoToDateInput(event.start_at));
    setStartTime(isoToTimeInput(event.start_at));
    setEndTime(isoToTimeInput(event.end_at));
    setAllDay(event.all_day);
    setCategory(event.category ?? 'work');
    setRecurrence(event.recurrence ?? '');
    setConfirmDelete(false);
    setSaving(false);
    setReminderMinutes(event.reminder_minutes ?? null);
  }, [event]);

  if (!event) {
    return null;
  }

  const readOnly = event.provider_readonly;

  const handleSave = async (): Promise<void> => {
    if (!title.trim() || saving || readOnly) {
      return;
    }
    setSaving(true);
    try {
      const start = new Date(`${date}T${allDay ? '00:00' : startTime}`);
      const end = new Date(`${date}T${allDay ? '23:59' : endTime}`);
      await onSave(event.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
        recurrence: recurrence || null,
        all_day: allDay,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        reminder_minutes: reminderMinutes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (readOnly || saving) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(event.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
    marginBottom: '0.25rem',
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.7rem 0.8rem',
    borderRadius: '12px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <Modal open title={readOnly ? 'Event details' : 'Edit event'} onClose={onClose}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div
          style={{
            padding: '0.8rem 0.9rem',
            borderRadius: '14px',
            border: `1px solid color-mix(in srgb, ${sourceColor} 30%, var(--border-subtle))`,
            background: `linear-gradient(160deg, color-mix(in srgb, ${sourceColor} 10%, var(--surface)), var(--surface))`,
            display: 'grid',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '999px',
                background: sourceColor,
                flexShrink: 0,
              }}
            />
            <strong>{sourceLabel}</strong>
            {readOnly && (
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, var(--text-secondary) 12%, transparent)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                🔒 Read-only mirror
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {event.category && (
              <span
                style={{
                  padding: '0.18rem 0.5rem',
                  borderRadius: '999px',
                  background: `color-mix(in srgb, ${sourceColor} 18%, var(--surface))`,
                  border: `1px solid color-mix(in srgb, ${sourceColor} 30%, var(--border-subtle))`,
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {event.category}
              </span>
            )}
            {event.recurrence && (
              <span
                style={{
                  padding: '0.18rem 0.5rem',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, var(--surface) 82%, white 18%)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {event.recurrence
                  .replace('FREQ=', '')
                  .toLowerCase()
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </span>
            )}
            {!event.all_day && (
              <span
                style={{
                  padding: '0.18rem 0.5rem',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, var(--surface) 82%, white 18%)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                }}
              >
                {new Date(event.start_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' – '}
                {new Date(event.end_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {event.all_day && (
              <span
                style={{
                  padding: '0.18rem 0.5rem',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, var(--surface) 82%, white 18%)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                }}
              >
                All day
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <label style={fieldLabel}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Event title"
              style={inputStyle}
              disabled={readOnly}
            />
          </div>

          <div>
            <label style={fieldLabel}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Event description"
              style={{ ...inputStyle, minHeight: '92px', resize: 'vertical' }}
              disabled={readOnly}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div>
              <label style={fieldLabel}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Event date"
                style={inputStyle}
                disabled={readOnly}
              />
            </div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Event category"
                style={inputStyle}
                disabled={readOnly}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              disabled={readOnly}
            />
            All day
          </label>

          {!allDay && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div>
                <label style={fieldLabel}>Starts</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  aria-label="Event start time"
                  style={inputStyle}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label style={fieldLabel}>Ends</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  aria-label="Event end time"
                  style={inputStyle}
                  disabled={readOnly}
                />
              </div>
            </div>
          )}

          <div>
            <label style={fieldLabel}>Repeats</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              aria-label="Event recurrence"
              style={inputStyle}
              disabled={readOnly}
            >
              {RECURRENCE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <label
              style={{
                display: 'flex',
                gap: '0.4rem',
                alignItems: 'center',
                cursor: readOnly ? 'default' : 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={reminderMinutes !== null}
                onChange={(e) => setReminderMinutes(e.target.checked ? 15 : null)}
                disabled={readOnly}
                style={{ accentColor: 'var(--accent)', cursor: readOnly ? 'default' : 'pointer' }}
              />
              TTS reminder
            </label>
            {reminderMinutes !== null && (
              <select
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                style={{
                  padding: '0.3rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-2, var(--surface))',
                  color: 'var(--text)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'inherit',
                }}
                disabled={readOnly}
              >
                <option value={5}>5 min before</option>
                <option value={15}>15 min before</option>
                <option value={30}>30 min before</option>
                <option value={60}>1 hour before</option>
              </select>
            )}
            {event.alarm_id && (
              <span
                style={{
                  padding: '0.18rem 0.5rem',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
              >
                Alarm linked
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {!readOnly && (
              <>
                <Button onClick={() => void handleDelete()} variant="secondary" disabled={saving}>
                  {saving && confirmDelete ? 'Deleting…' : confirmDelete ? 'Yes, delete' : 'Delete'}
                </Button>
                {confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: '0.48rem 0.7rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--text-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
            {!readOnly && (
              <Button
                onClick={() => void handleSave()}
                variant="primary"
                disabled={saving || !title.trim()}
              >
                {saving && !confirmDelete ? 'Saving…' : 'Save changes'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
