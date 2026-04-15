import type { Task } from '../../../../shared/types';

interface EisenhowerViewProps {
  quadrants: { q1: Task[]; q2: Task[]; q3: Task[]; q4: Task[] };
  onEdit?: (task: Task) => void;
}

function cell(
  title: string,
  cue: string,
  tasks: Task[],
  tone: string,
  onEdit?: (task: Task) => void,
): JSX.Element {
  return (
    <section
      style={{
        padding: '1rem',
        borderRadius: 18,
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--surface) 88%, white 12%), var(--surface))',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        gap: '0.75rem',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          gap: '0.6rem',
        }}
      >
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <strong style={{ color: tone }}>{title}</strong>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {cue}
          </span>
        </div>
        <span
          style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 700 }}
        >
          {tasks.length}
        </span>
      </div>
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {tasks.length === 0 ? (
          <div
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              padding: '0.85rem',
              borderRadius: '12px',
              border: '1px dashed var(--border-subtle)',
              background: 'var(--surface-2)',
            }}
          >
            Nothing in this quadrant right now.
          </div>
        ) : (
          tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onEdit?.(task)}
              style={{
                fontSize: 'var(--text-sm)',
                padding: '0.6rem 0.7rem',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                border: 'none',
                textAlign: 'left',
                cursor: onEdit ? 'pointer' : 'default',
                width: '100%',
                color: 'inherit',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (onEdit) {
                  (e.currentTarget as HTMLElement).style.background =
                    'var(--surface-3, color-mix(in srgb, var(--surface-2) 80%, var(--accent) 20%))';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
              }}
            >
              {task.title}
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export default function EisenhowerView({ quadrants, onEdit }: EisenhowerViewProps): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1rem',
      }}
    >
      {cell('Q1 · Do', 'urgent + important', quadrants.q1, 'var(--state-overdue)', onEdit)}
      {cell('Q2 · Schedule', 'important, not urgent', quadrants.q2, 'var(--accent)', onEdit)}
      {cell('Q3 · Delegate', 'urgent, lower leverage', quadrants.q3, 'var(--state-warn)', onEdit)}
      {cell('Q4 · Eliminate', 'noise or drift', quadrants.q4, 'var(--text-secondary)', onEdit)}
    </div>
  );
}
