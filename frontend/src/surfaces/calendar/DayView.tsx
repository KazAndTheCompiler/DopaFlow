import { useRef, useState } from 'react';
import type { CalendarEvent } from '../../../../shared/types';
import EmptyState from '../../design-system/primitives/EmptyState';
import { CATEGORY_COLORS } from './WeekView';

interface DayViewProps {
  events: CalendarEvent[];
  date?: Date;
  onSlotClick?: (hour: number) => void;
  sourceColors?: Record<string, string>;
  sourceLabels?: Record<string, string>;
  onEventClick?: (event: CalendarEvent) => void;
  onRescheduleEvent?: (id: string, newStartAt: string) => Promise<void>;
  onResizeEvent?: (id: string, newEndAt: string) => Promise<void>;
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
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

function isLocalEditable(event: CalendarEvent): boolean {
  return !event.provider_readonly && !event.source_type?.startsWith('peer:');
}

const HOUR_ROW_REM = 2.5;
const TOTAL_HOURS = 24;

function topOffsetRem(event: CalendarEvent): number {
  const start = new Date(event.start_at);
  return start.getHours() * HOUR_ROW_REM + (start.getMinutes() / 60) * HOUR_ROW_REM + 0.2;
}

function heightRem(event: CalendarEvent): number {
  const start = new Date(event.start_at).getTime();
  const end = new Date(event.end_at).getTime();
  const minutes = Math.max(30, Math.round((end - start) / 60_000));
  return Math.max(1, (minutes / 60) * HOUR_ROW_REM - 0.4);
}

function remToSnappedTime(rem: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(((rem / HOUR_ROW_REM) * 60) / 15) * 15;
  const clamped = Math.max(0, Math.min(totalMinutes, TOTAL_HOURS * 60 - 15));
  return { hours: Math.floor(clamped / 60), minutes: clamped % 60 };
}

const MIN_HEIGHT_REM = HOUR_ROW_REM / 4; // 15 min minimum

type DragRef = {
  id: string;
  type: 'move' | 'resize';
  startMouseY: number;
  startTopRem: number;
  startHeightRem: number;
  pixelsPerRem: number;
};

type DragVisual = { id: string; topRem: number; heightRem: number };

export function DayView({
  events,
  date,
  onSlotClick,
  sourceColors = {},
  sourceLabels = {},
  onEventClick,
  onRescheduleEvent,
  onResizeEvent,
}: DayViewProps): JSX.Element {
  const targetDate = date ?? new Date();
  const dayEvents = events.filter((event) => sameDay(new Date(event.start_at), targetDate));
  const allDayEvents = dayEvents.filter((event) => event.all_day);
  const timedEvents = dayEvents.filter((event) => !event.all_day);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const now = new Date();
  const currentHour = sameDay(targetDate, now) ? now.getHours() : -1;
  const hasEvents = dayEvents.length > 0;

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragRef | null>(null);
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function getPixelsPerRem(): number {
    if (!gridRef.current) {
      return 16;
    }
    return gridRef.current.getBoundingClientRect().height / (TOTAL_HOURS * HOUR_ROW_REM);
  }

  const onMoveMouseDown = (e: React.MouseEvent, event: CalendarEvent): void => {
    if (!isLocalEditable(event) || !onRescheduleEvent) {
      return;
    }
    e.stopPropagation();
    const tRem = topOffsetRem(event);
    const hRem = heightRem(event);
    dragRef.current = {
      id: event.id,
      type: 'move',
      startMouseY: e.clientY,
      startTopRem: tRem,
      startHeightRem: hRem,
      pixelsPerRem: getPixelsPerRem(),
    };
    // Note: dragVisual is NOT set here — drag only activates on first mousemove
    // This prevents click+mouseup from being mistaken for a reschedule
  };

  const onResizeMouseDown = (e: React.MouseEvent, event: CalendarEvent): void => {
    if (!isLocalEditable(event) || !onResizeEvent) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const tRem = topOffsetRem(event);
    const hRem = heightRem(event);
    dragRef.current = {
      id: event.id,
      type: 'resize',
      startMouseY: e.clientY,
      startTopRem: tRem,
      startHeightRem: hRem,
      pixelsPerRem: getPixelsPerRem(),
    };
    // Note: dragVisual is NOT set here — only on first mousemove
  };

  const onGridMouseMove = (e: React.MouseEvent): void => {
    if (!dragRef.current) {
      return;
    }
    const { id, type, startMouseY, startTopRem, startHeightRem, pixelsPerRem } = dragRef.current;
    const deltaRem = (e.clientY - startMouseY) / pixelsPerRem;
    // Require at least 2px movement before starting visual drag
    if (Math.abs(e.clientY - startMouseY) < 2 && !dragVisual) {
      return;
    }
    const maxTopRem = TOTAL_HOURS * HOUR_ROW_REM - MIN_HEIGHT_REM;
    if (type === 'move') {
      const newTop = Math.max(0, Math.min(startTopRem + deltaRem, maxTopRem));
      setDragVisual({ id, topRem: newTop, heightRem: startHeightRem });
    } else {
      const newHeight = Math.max(MIN_HEIGHT_REM, startHeightRem + deltaRem);
      setDragVisual({ id, topRem: startTopRem, heightRem: newHeight });
    }
  };

  const onGridMouseUp = async (): Promise<void> => {
    if (!dragRef.current || !dragVisual) {
      dragRef.current = null;
      setDragVisual(null);
      return;
    }
    const { id, type } = dragRef.current;
    const visual = { ...dragVisual };
    dragRef.current = null;
    setDragVisual(null);

    const event = timedEvents.find((e) => e.id === id);
    if (!event) {
      return;
    }

    if (type === 'move' && onRescheduleEvent) {
      const { hours: h, minutes: m } = remToSnappedTime(visual.topRem);
      const newStart = new Date(event.start_at);
      newStart.setHours(h, m, 0, 0);
      setPendingId(id);
      try {
        await onRescheduleEvent(id, newStart.toISOString());
      } finally {
        setPendingId(null);
      }
    } else if (type === 'resize' && onResizeEvent) {
      const endRem = visual.topRem + visual.heightRem;
      const startMinutes = (visual.topRem / HOUR_ROW_REM) * 60;
      const { hours: eh, minutes: em } = remToSnappedTime(endRem);
      const endMinutes = eh * 60 + em;
      const safeDuration = Math.max(15, endMinutes - startMinutes);
      const safeEndMinutes = startMinutes + safeDuration;
      const finalH = Math.min(Math.floor(safeEndMinutes / 60), 23);
      const finalM = safeEndMinutes % 60;
      const newEnd = new Date(event.end_at);
      newEnd.setHours(finalH, finalM, 0, 0);
      setPendingId(id);
      try {
        await onResizeEvent(id, newEnd.toISOString());
      } finally {
        setPendingId(null);
      }
    }
  };

  return (
    <section
      style={{
        padding: '1rem',
        background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
        backdropFilter: 'var(--surface-glass-blur, blur(14px))',
        borderRadius: '18px',
        border: '1px solid var(--border-subtle)',
        maxHeight: '600px',
        overflowY: 'auto',
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
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        <strong>All day</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {allDayEvents.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              No all-day events.
            </span>
          ) : (
            allDayEvents.map((event) => {
              const sourceKey = eventSourceKey(event);
              return (
                <span
                  key={event.id}
                  title={sourceLabels[sourceKey] ?? 'Local'}
                  style={{
                    padding: '0.35rem 0.6rem',
                    borderRadius: '999px',
                    background: sourceColors[sourceKey] ?? eventColor(event),
                    color: 'var(--text-inverted)',
                    fontSize: 'var(--text-sm)',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: event.provider_readonly ? 0.88 : 1,
                  }}
                >
                  {event.title}
                </span>
              );
            })
          )}
        </div>
      </div>

      {!hasEvents && (
        <EmptyState
          icon="CL"
          title="Open day"
          subtitle="No events are scheduled here yet. Click an hour slot to block time or pull in a shared calendar feed."
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateRows: `repeat(24, ${HOUR_ROW_REM}rem)` }}>
          {hours.map((hour) => (
            <div
              key={hour}
              style={{
                height: `${HOUR_ROW_REM}rem`,
                display: 'flex',
                alignItems: 'start',
                justifyContent: 'flex-end',
                paddingRight: '0.4rem',
                fontSize: '0.7rem',
                color: hour === currentHour ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: hour === currentHour ? 700 : 400,
              }}
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div
          ref={gridRef}
          onMouseMove={onGridMouseMove}
          onMouseUp={() => {
            void onGridMouseUp();
          }}
          onMouseLeave={() => {
            void onGridMouseUp();
          }}
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateRows: `repeat(24, ${HOUR_ROW_REM}rem)`,
            userSelect: 'none',
          }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              onClick={() => onSlotClick?.(hour)}
              style={{
                borderTop: 'none',
                borderBottom:
                  hour === currentHour
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border-subtle)',
                background:
                  hour === currentHour
                    ? 'color-mix(in srgb, var(--accent) 5%, transparent)'
                    : 'transparent',
                cursor: onSlotClick ? 'pointer' : 'default',
              }}
              title={onSlotClick ? `Block ${String(hour).padStart(2, '0')}:00` : undefined}
            />
          ))}

          {timedEvents.map((event) => {
            const isDragging = dragVisual?.id === event.id;
            const isPending = pendingId === event.id;
            const start = new Date(event.start_at);
            const sourceKey = eventSourceKey(event);
            const sourceColor = sourceColors[sourceKey] ?? eventColor(event);
            const sourceLabel = sourceLabels[sourceKey] ?? 'Local';
            const canInteract = isLocalEditable(event);
            const canDrag = canInteract && !!onRescheduleEvent;
            const canResize = canInteract && !!onResizeEvent;

            const topRem = isDragging ? dragVisual!.topRem : topOffsetRem(event);
            const hRem = isDragging ? dragVisual!.heightRem : heightRem(event);

            return (
              <div
                key={event.id}
                title={`${event.title} · ${sourceLabel}${event.provider_readonly ? ' · read-only' : canDrag ? ' · drag to reschedule' : ''}`}
                onMouseDown={canDrag ? (e) => onMoveMouseDown(e, event) : undefined}
                onClick={isDragging ? undefined : () => onEventClick?.(event)}
                style={{
                  position: 'absolute',
                  left: '0.45rem',
                  right: '0.45rem',
                  top: `${topRem}rem`,
                  minHeight: '1rem',
                  height: `${hRem}rem`,
                  padding: '0.45rem 0.6rem',
                  borderRadius: '12px',
                  background: `linear-gradient(165deg, color-mix(in srgb, ${sourceColor} 24%, var(--surface)), color-mix(in srgb, ${sourceColor} 14%, var(--surface)))`,
                  border: isDragging
                    ? `2px solid ${sourceColor}`
                    : `1px solid color-mix(in srgb, ${sourceColor} 40%, var(--border-subtle))`,
                  opacity: isPending ? 0.6 : event.provider_readonly ? 0.84 : 1,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  cursor: isDragging ? 'grabbing' : canDrag ? 'grab' : 'pointer',
                  pointerEvents: 'auto',
                  display: 'grid',
                  alignContent: 'start',
                  gap: '0.2rem',
                  boxShadow: isDragging ? '0 6px 20px rgba(0,0,0,0.22)' : 'var(--shadow-soft)',
                  zIndex: isDragging ? 20 : 1,
                  transition: isDragging ? 'none' : 'top 80ms ease, height 80ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '999px',
                      background: sourceColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.65rem',
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
                    <span
                      style={{
                        fontSize: '0.6rem',
                        color: 'var(--text-secondary)',
                        opacity: 0.7,
                        flexShrink: 0,
                      }}
                    >
                      🔒
                    </span>
                  )}
                  {isPending && (
                    <span
                      style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', flexShrink: 0 }}
                    >
                      …
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
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
                    fontSize: '0.68rem',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {String(start.getHours()).padStart(2, '0')}:
                  {String(start.getMinutes()).padStart(2, '0')}
                  {' - '}
                  {new Date(event.end_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {event.recurrence ? ' · repeats' : ''}
                </span>

                {canResize && (
                  <div
                    onMouseDown={(e) => onResizeMouseDown(e, event)}
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '28px',
                      height: '5px',
                      borderRadius: '3px',
                      background: `color-mix(in srgb, ${sourceColor} 50%, transparent)`,
                      cursor: 'ns-resize',
                      flexShrink: 0,
                    }}
                    title="Drag to resize"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default DayView;
