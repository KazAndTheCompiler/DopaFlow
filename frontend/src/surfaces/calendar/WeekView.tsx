import { useMemo } from 'react';

import type { CalendarEvent } from '../../../../shared/types';
import EmptyState from '../../design-system/primitives/EmptyState';

interface WeekViewProps {
  events: CalendarEvent[];
  anchorDate?: Date;
  sourceColors?: Record<string, string>;
  sourceLabels?: Record<string, string>;
  onEventClick?: (event: CalendarEvent) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const CATEGORY_COLORS: Record<string, string> = {
  work: 'var(--accent)',
  personal: 'var(--state-completed)',
  health: 'var(--state-warn)',
  focus: 'var(--accent)',
  task: 'var(--accent-tertiary, #f59e0b)',
};

function weekDates(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function sameDay(d1: Date, d2: Date): boolean {
  return d1.toDateString() === d2.toDateString();
}

function eventColor(event: CalendarEvent): string {
  return CATEGORY_COLORS[event.category ?? ''] ?? 'var(--accent)';
}

function eventSourceKey(event: CalendarEvent): string {
  if (event.source_type?.startsWith('peer:')) {
    return event.source_type.slice('peer:'.length);
  }
  return 'local';
}

export function WeekView({
  events,
  anchorDate,
  sourceColors = {},
  sourceLabels = {},
  onEventClick,
}: WeekViewProps): JSX.Element {
  const anchor = anchorDate ?? new Date();
  const days = useMemo(() => weekDates(anchor), [anchor]);

  const today = new Date();
  const weekHasEvents = days.some((day) =>
    events.some((event) => sameDay(new Date(event.start_at), day)),
  );

  return (
    <section
      style={{
        background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
        backdropFilter: 'var(--surface-glass-blur, blur(14px))',
        borderRadius: '20px',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
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
          borderRadius: '14px 14px 0 0',
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'relative',
        }}
      >
        {days.map((day, i) => {
          const isToday = sameDay(day, today);
          return (
            <div
              key={i}
              style={{
                padding: '0.65rem 0.5rem',
                textAlign: 'center',
                background: isToday ? 'var(--surface-2)' : 'transparent',
                borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                {DAYS[day.getDay()]}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? 'var(--text-inverted)' : 'var(--text-primary)',
                  fontWeight: isToday ? 700 : 400,
                  fontSize: 'var(--text-sm)',
                  marginTop: '0.15rem',
                }}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {!weekHasEvents ? (
        <div style={{ padding: '1.5rem' }}>
          <EmptyState
            icon="□"
            title="Nothing scheduled this week"
            subtitle="This range is clear. Shared feeds and local events will show up here as soon as they land in view."
          />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            minHeight: '140px',
          }}
        >
          {days.map((day, i) => {
            const dayEvents = events.filter((e) => {
              const evDate = new Date(e.start_at);
              return sameDay(evDate, day);
            });

            return (
              <div
                key={i}
                style={{
                  padding: '0.4rem 0.35rem',
                  borderRight: i < 6 ? '1px solid var(--border-subtle)' : 'none',
                  minHeight: '120px',
                  background: sameDay(day, today)
                    ? 'color-mix(in srgb, var(--accent) 4%, transparent)'
                    : 'transparent',
                }}
              >
                {dayEvents.length === 0 && <div style={{ height: '4px' }} />}
                {dayEvents.slice(0, 4).map((event) => {
                  const sourceKey = eventSourceKey(event);
                  const sourceColor = sourceColors[sourceKey] ?? eventColor(event);
                  const sourceLabel = sourceLabels[sourceKey] ?? 'Local';

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      title={`${event.title} · ${sourceLabel} · ${new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${event.provider_readonly ? ' · read-only' : ''}`}
                      style={{
                        marginBottom: '6px',
                        padding: '0.38rem 0.42rem 0.4rem',
                        borderRadius: '10px',
                        background: `linear-gradient(160deg, color-mix(in srgb, ${sourceColor} 18%, var(--surface)), color-mix(in srgb, ${sourceColor} 11%, var(--surface)))`,
                        border: `1px solid color-mix(in srgb, ${sourceColor} 34%, var(--border-subtle))`,
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        opacity: event.provider_readonly ? 0.88 : 1,
                        boxShadow: 'var(--shadow-soft)',
                        display: 'grid',
                        gap: '0.15rem',
                        width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '999px',
                            background: sourceColor,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {sourceLabel}
                        </span>
                        {event.provider_readonly && (
                          <span style={{ fontSize: '9px', opacity: 0.6, flexShrink: 0 }}>🔒</span>
                        )}
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {event.title}
                      </span>
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {event.all_day
                          ? 'All day'
                          : `${new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </button>
                  );
                })}
                {dayEvents.length > 4 && (
                  <button
                    type="button"
                    onClick={() => onEventClick?.(dayEvents[4])}
                    style={{
                      padding: '0.25rem 0.4rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      fontWeight: 600,
                    }}
                  >
                    + {dayEvents.length - 4} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default WeekView;
