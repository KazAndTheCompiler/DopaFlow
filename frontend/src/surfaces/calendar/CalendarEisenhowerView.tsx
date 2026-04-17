import type { CalendarEvent } from '../../../../shared/types';

const URGENT_HOURS = 48; // events starting within this many hours are "urgent"

const IMPORTANT_CATEGORIES = new Set(['work', 'focus']);

function isUrgent(event: CalendarEvent): boolean {
  const hoursUntilStart = (new Date(event.start_at).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilStart <= URGENT_HOURS;
}

function isImportant(event: CalendarEvent): boolean {
  const cat = event.category?.toLowerCase() ?? '';
  return IMPORTANT_CATEGORIES.has(cat);
}

function eventPriority(event: CalendarEvent): number {
  const urgent = isUrgent(event);
  const important = isImportant(event);
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

function formatEventTime(event: CalendarEvent): string {
  if (event.all_day) {
    return 'All day';
  }
  const start = new Date(event.start_at);
  return start.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface EisenhowerQuadrant {
  id: string;
  label: string;
  sub: string;
  borderColor: string;
  headerBg: string;
  events: CalendarEvent[];
}

interface CalendarEisenhowerViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

function QuadrantCard({
  quadrant,
  onEventClick,
}: {
  quadrant: EisenhowerQuadrant;
  onEventClick: (event: CalendarEvent) => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: '0.55rem',
        borderRadius: '18px',
        border: `1px solid ${quadrant.borderColor}`,
        background: 'var(--surface)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div
        style={{
          padding: '0.75rem 1rem',
          background: quadrant.headerBg,
          display: 'grid',
          gap: '0.1rem',
        }}
      >
        <strong style={{ fontSize: 'var(--text-sm)' }}>{quadrant.label}</strong>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {quadrant.sub}
        </span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: '0.15rem',
          }}
        >
          {quadrant.events.length} event{quadrant.events.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gap: '0.4rem', padding: '0 0.75rem 0.75rem' }}>
        {quadrant.events.length === 0 ? (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '0.6rem 0',
            }}
          >
            Clear
          </span>
        ) : (
          quadrant.events.map((event) => (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                padding: '0.55rem 0.7rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {priorityBadge(eventPriority(event))}
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.15rem' }}>
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
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {formatEventTime(event)}
                </span>
                {event.category && (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {event.category}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function CalendarEisenhowerView({
  events,
  onEventClick,
}: CalendarEisenhowerViewProps): JSX.Element {
  const q1: CalendarEvent[] = [];
  const q2: CalendarEvent[] = [];
  const q3: CalendarEvent[] = [];
  const q4: CalendarEvent[] = [];

  for (const event of events) {
    const urgent = isUrgent(event);
    const important = isImportant(event);
    if (urgent && important) {
      q1.push(event);
    } else if (!urgent && important) {
      q2.push(event);
    } else if (urgent && !important) {
      q3.push(event);
    } else {
      q4.push(event);
    }
  }

  const sort = (arr: CalendarEvent[]): void => {
    arr.sort((a, b) => a.start_at.localeCompare(b.start_at));
  };
  sort(q1);
  sort(q2);
  sort(q3);
  sort(q4);

  const quadrants: EisenhowerQuadrant[] = [
    {
      id: 'q1',
      label: 'Do First',
      sub: 'Urgent + Important (work/focus within 48h)',
      borderColor: 'color-mix(in srgb, var(--state-overdue) 35%, var(--border-subtle))',
      headerBg: 'color-mix(in srgb, var(--state-overdue) 10%, var(--surface))',
      events: q1,
    },
    {
      id: 'q2',
      label: 'Schedule',
      sub: 'Not urgent + Important (upcoming work/focus)',
      borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border-subtle))',
      headerBg: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
      events: q2,
    },
    {
      id: 'q3',
      label: 'Delegate',
      sub: 'Urgent + Not important (health/personal within 48h)',
      borderColor: 'color-mix(in srgb, var(--state-warn) 35%, var(--border-subtle))',
      headerBg: 'color-mix(in srgb, var(--state-warn) 10%, var(--surface))',
      events: q3,
    },
    {
      id: 'q4',
      label: 'Drop',
      sub: 'Not urgent + Not important (health/personal later)',
      borderColor: 'color-mix(in srgb, var(--text-muted) 25%, var(--border-subtle))',
      headerBg: 'var(--surface-2)',
      events: q4,
    },
  ];

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div
        style={{
          padding: '0.65rem 0.9rem',
          borderRadius: '12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        Urgency = starts within 48 h · Importance = Work or Focus category. Click any event to edit.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.9rem',
          alignItems: 'start',
        }}
      >
        {quadrants.map((q) => (
          <QuadrantCard key={q.id} quadrant={q} onEventClick={onEventClick} />
        ))}
      </div>
    </div>
  );
}
