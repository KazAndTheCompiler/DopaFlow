import type { TaskFilters } from '@hooks/useTasks';

export interface TaskFilterBarProps {
  total: number;
  filters: TaskFilters;
  onFilterChange: (filters: TaskFilters) => void;
  sortBy?: string;
  onSortByChange?: (sortBy: string) => void;
}

function filterButton(active: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 0.8rem',
    borderRadius: '999px',
    border: '1px solid var(--border-subtle)',
    background: active ? 'var(--accent)' : 'var(--surface-2)',
    color: active ? 'var(--text-inverted)' : 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
  };
}

export function TaskFilterBar({
  total,
  filters,
  onFilterChange,
  sortBy = 'default',
  onSortByChange,
}: TaskFilterBarProps): JSX.Element {
  return (
    <section
      style={{
        display: 'grid',
        gap: '0.85rem',
        padding: '0.95rem 1rem',
        borderRadius: '20px',
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--surface) 88%, white 12%), var(--surface))',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <strong style={{ fontSize: 'var(--text-base)' }}>Filter and sort</strong>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Narrow the list until it becomes actionable.
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          {total} tasks in view
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            style={filterButton(filters.done === null)}
            onClick={() => onFilterChange({ ...filters, done: null })}
          >
            All
          </button>
          <button
            style={filterButton(filters.done === false)}
            onClick={() => onFilterChange({ ...filters, done: false })}
          >
            Pending
          </button>
          <button
            style={filterButton(filters.done === true)}
            onClick={() => onFilterChange({ ...filters, done: true })}
          >
            Done
          </button>
          <button
            style={filterButton(filters.dueToday)}
            onClick={() => onFilterChange({ ...filters, dueToday: !filters.dueToday })}
          >
            Due today
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)' }}>Priority</span>
            <select
              value={filters.priority ?? ''}
              onChange={(event) =>
                onFilterChange({
                  ...filters,
                  priority: event.currentTarget.value ? Number(event.currentTarget.value) : null,
                })
              }
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Any</option>
              <option value="1">P1</option>
              <option value="2">P2</option>
              <option value="3">P3</option>
              <option value="4">P4</option>
            </select>
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)' }}>Sort</span>
            <select
              value={sortBy}
              onChange={(event) => onSortByChange?.(event.currentTarget.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="default">Default</option>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="title">A-Z</option>
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}

export default TaskFilterBar;
