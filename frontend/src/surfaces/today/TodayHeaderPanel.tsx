import type { CalendarEvent, Task } from '@shared/types';

import type { TodayActionCard, TodayDayState } from './TodayShared';

interface TodayHeaderPanelProps {
  dateLabel: string;
  dayState: TodayDayState;
  dayOffset: number;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  nextAction: TodayActionCard;
  focusQueue: Task[];
  backlogCount: number;
  completedToday: number;
  nextUpcomingEvent: CalendarEvent | null;
}

export function TodayHeaderPanel({
  dateLabel,
  dayState,
  dayOffset,
  onPrevDay,
  onToday,
  onNextDay,
  nextAction,
  focusQueue,
  backlogCount,
  completedToday,
  nextUpcomingEvent,
}: TodayHeaderPanelProps): JSX.Element {
  return (
    <>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          padding: '1rem',
          borderRadius: '20px',
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          backdropFilter: 'var(--surface-glass-blur, blur(14px))',
          border: '1px solid var(--border-subtle)',
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
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <strong style={{ display: 'block', fontSize: 'var(--text-lg)' }}>Today</strong>
            <span
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                background: dayState.bg,
                color: dayState.tone,
                fontSize: 'var(--text-xs)',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {dayState.label}
            </span>
          </div>
          <span style={{ color: 'var(--text-secondary)' }}>{dateLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            onClick={onPrevDay}
            aria-label="Previous day"
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
            }}
          >
            ‹ Prev
          </button>
          <button
            onClick={onToday}
            aria-label="Jump to today"
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: dayOffset === 0 ? 'var(--accent)' : 'transparent',
              color: dayOffset === 0 ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
            }}
          >
            Today
          </button>
          <button
            onClick={onNextDay}
            aria-label="Next day"
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
            }}
          >
            Next ›
          </button>
        </div>
      </header>

      <section
        style={{
          padding: '1.1rem 1.15rem',
          borderRadius: '20px',
          background:
            'linear-gradient(145deg, color-mix(in srgb, var(--accent) 10%, var(--surface)), var(--surface))',
          border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border-subtle))',
          display: 'grid',
          gap: '0.9rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.75rem',
            alignItems: 'start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 800,
              }}
            >
              {nextAction.eyebrow}
            </span>
            <strong style={{ fontSize: 'var(--text-lg)' }}>{nextAction.title}</strong>
            <span
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.5,
              }}
            >
              {nextAction.body}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={nextAction.primaryAction}
              style={{
                padding: '0.6rem 0.95rem',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--text-inverted)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 'var(--text-sm)',
              }}
            >
              {nextAction.primaryLabel}
            </button>
            <button
              onClick={nextAction.secondaryAction}
              style={{
                padding: '0.6rem 0.95rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'color-mix(in srgb, var(--surface) 76%, white 24%)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
              }}
            >
              {nextAction.secondaryLabel}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <TodayStatCard
            label="Queue"
            value={focusQueue.filter((task) => !task.done).length.toString()}
            subtitle="ready to execute"
          />
          <TodayStatCard
            label="Backlog"
            value={backlogCount.toString()}
            subtitle="unscheduled tasks"
          />
          <TodayStatCard
            label="Done"
            value={completedToday.toString()}
            subtitle="completed on this date"
          />
          <TodayStatCard
            label="Next event"
            value={
              nextUpcomingEvent
                ? new Date(nextUpcomingEvent.start_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Clear'
            }
            valueFontSize={nextUpcomingEvent ? 'var(--text-base)' : '1.35rem'}
            subtitle={nextUpcomingEvent ? nextUpcomingEvent.title : 'no calendar block yet'}
          />
        </div>
      </section>
    </>
  );
}

function TodayStatCard({
  label,
  value,
  subtitle,
  valueFontSize = '1.35rem',
}: {
  label: string;
  value: string;
  subtitle: string;
  valueFontSize?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: '0.8rem 0.9rem',
        borderRadius: '16px',
        background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
        backdropFilter: 'var(--surface-glass-blur, blur(14px))',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        gap: '0.15rem',
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
          background: 'var(--surface-specular)',
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <strong style={{ fontSize: valueFontSize }}>{value}</strong>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{subtitle}</span>
    </div>
  );
}
