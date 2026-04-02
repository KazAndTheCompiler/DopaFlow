import type { TaskFilters } from "@hooks/useTasks";

export interface TaskFilterBarProps {
  total: number;
  filters: TaskFilters;
  onFilterChange: (filters: TaskFilters) => void;
  sortBy?: string;
  onSortByChange?: (sortBy: string) => void;
}

function filterButton(active: boolean): React.CSSProperties {
  return {
    padding: "0.4rem 0.8rem",
    borderRadius: "999px",
    border: "1px solid var(--border-subtle)",
    background: active ? "var(--accent)" : "var(--surface-2)",
    color: active ? "var(--text-inverted)" : "var(--text-primary)",
    cursor: "pointer",
    fontSize: "var(--text-sm)",
  };
}

export function TaskFilterBar({ total, filters, onFilterChange, sortBy = "default", onSortByChange }: TaskFilterBarProps): JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "center",
        padding: "0.85rem 1rem",
        borderRadius: "18px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button style={filterButton(filters.done === null)} onClick={() => onFilterChange({ ...filters, done: null })}>
          All
        </button>
        <button style={filterButton(filters.done === false)} onClick={() => onFilterChange({ ...filters, done: false })}>
          Pending
        </button>
        <button style={filterButton(filters.done === true)} onClick={() => onFilterChange({ ...filters, done: true })}>
          Done
        </button>
      </div>
      <button
        style={filterButton(filters.dueToday)}
        onClick={() => onFilterChange({ ...filters, dueToday: !filters.dueToday })}
      >
        Due today
      </button>
      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-secondary)" }}>
        <span style={{ fontSize: "var(--text-sm)" }}>Priority</span>
        <select
          value={filters.priority ?? ""}
          onChange={(event) =>
            onFilterChange({ ...filters, priority: event.currentTarget.value ? Number(event.currentTarget.value) : null })
          }
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
          }}
        >
          <option value="">Any</option>
          <option value="1">P1</option>
          <option value="2">P2</option>
          <option value="3">P3</option>
          <option value="4">P4</option>
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--text-secondary)" }}>
        <span style={{ fontSize: "var(--text-sm)" }}>Sort</span>
        <select
          value={sortBy}
          onChange={(event) => onSortByChange?.(event.currentTarget.value)}
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
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
      <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{total} tasks</span>
    </section>
  );
}

export default TaskFilterBar;
