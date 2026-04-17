import type { CalendarEvent } from '../../../../shared/types';

const CATEGORY_COLUMNS: Array<{ id: string; label: string; color: string }> = [
  { id: 'work', label: 'Work', color: 'var(--accent)' },
  { id: 'focus', label: 'Focus', color: 'var(--state-ok)' },
  { id: 'health', label: 'Health', color: '#e44' },
  { id: 'personal', label: 'Personal', color: 'var(--state-warn)' },
  { id: 'other', label: 'Other', color: 'var(--text-muted)' },
];

function eventCategory(event: CalendarEvent): string {
  const cat = event.category?.toLowerCase();
  if (cat && ['work', 'focus', 'health', 'personal'].includes(cat)) {
    return cat;
  }
  return 'other';
}

function formatEventTime(event: CalendarEvent): string {
  if (event.all_day) {
    return 'All day';
  }
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const fmt = (d: Date): string =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatEventDate(event: CalendarEvent): string {
  return new Date(event.start_at).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const URGENT_HOURS = 48;
const IMPORTANT_CATEGORIES = new Set(['work', 'focus']);

function eventPriority(event: CalendarEvent): number {
  const hoursUntil = (new Date(event.start_at).getTime() - Date.now()) / (1000 * 60 * 60);
  const urgent = hoursUntil <= URGENT_HOURS;
  const important = IMPORTANT_CATEGORIES.has(event.category?.toLowerCase() ?? '');
  if (urgent && important) {
    return 1;
  }
  if (!urgent && important) {
    return 2;
  }
  if (urgent && !important) {
    return 3;
  }
  return 4;
}

function priorityBadge(priority: number): JSX.Element {
  const color =
    priority === 1
      ? 'var(--state-overdue)'
      : priority === 2
        ? 'var(--state-warn)'
        : priority === 3
          ? 'var(--accent)'
          : 'var(--text-muted)';
  const bg =
    priority === 1
      ? 'color-mix(in srgb, var(--state-overdue) 14%, transparent)'
      : priority === 2
        ? 'color-mix(in srgb, var(--state-warn) 14%, transparent)'
        : priority === 3
          ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
          : 'var(--surface-2)';
  return (
    <span
      style={{
        padding: '0.1rem 0.4rem',
        borderRadius: '4px',
        background: bg,
        color,
        fontSize: '0.65rem',
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      P{priority}
    </span>
  );
}

interface CalendarKanbanViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export default function CalendarKanbanView({
  events,
  onEventClick,
}: CalendarKanbanViewProps): JSX.Element {
  const byCategory = new Map<string, CalendarEvent[]>(CATEGORY_COLUMNS.map((col) => [col.id, []]));

  for (const event of events) {
    const cat = eventCategory(event);
    const list = byCategory.get(cat);
    if (list) {
      list.push(event);
    }
  }

  // Sort each column by start_at
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.start_at.localeCompare(b.start_at));
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.9rem',
        alignItems: 'start',
      }}
    >
      {CATEGORY_COLUMNS.map((col) => {
        const colEvents = byCategory.get(col.id) ?? [];
        return (
          <div
            key={col.id}
            style={{
              display: 'grid',
              gap: '0.55rem',
              padding: '0.85rem 0.9rem',
              borderRadius: '18px',
              background: 'var(--surface)',
              border: `1px solid color-mix(in srgb, ${col.color} 22%, var(--border-subtle))`,
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                paddingBottom: '0.4rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: col.color,
                  flexShrink: 0,
                }}
              />
              <strong style={{ fontSize: 'var(--text-sm)', flex: 1 }}>{col.label}</strong>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  background: 'var(--surface-2)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                }}
              >
                {colEvents.length}
              </span>
            </div>

            {colEvents.length === 0 ? (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '0.75rem 0',
                }}
              >
                No events
              </span>
            ) : (
              colEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  style={{
                    display: 'grid',
                    gap: '0.15rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      `color-mix(in srgb, ${col.color} 10%, var(--surface-2))`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {priorityBadge(eventPriority(event))}
                    <span
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {event.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {formatEventDate(event)}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {formatEventTime(event)}
                  </span>
                </button>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
