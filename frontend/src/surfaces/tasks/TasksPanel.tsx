import type { Task } from "../../../../shared/types";
import TaskRow from "./TaskRow";
import EmptyState from "@ds/primitives/EmptyState";
import { SkeletonList } from "@ds/primitives/Skeleton";

export interface TasksPanelProps {
  tasks: Task[];
  loading?: boolean;
  onComplete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onBulkComplete?: (ids: string[]) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onClearSelection?: () => void;
}

export function TasksPanel({
  tasks,
  loading = false,
  onComplete,
  onEdit,
  selectedIds = new Set(),
  onToggleSelect,
  onBulkComplete,
  onBulkDelete,
  onClearSelection,
}: TasksPanelProps): JSX.Element {
  if (loading) {
    return <SkeletonList rows={6} />;
  }
  const handleBulkComplete = async (): Promise<void> => {
    if (selectedIds.size === 0) {
 return;
}
    await onBulkComplete?.(Array.from(selectedIds));
  };

  const handleBulkDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) {
 return;
}
    await onBulkDelete?.(Array.from(selectedIds));
  };

  if (tasks.length === 0) {
    return <EmptyState icon="OK" title="All clear" subtitle="Nothing left to do — or add a task above." />;
  }

  return (
    <section
      style={{
        padding: "0.9rem 1rem 1rem",
        borderRadius: "22px",
        background: "linear-gradient(155deg, color-mix(in srgb, var(--surface) 86%, white 14%), var(--surface))",
        border: "1px solid var(--border-subtle)",
        position: "relative",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.8rem", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: "0.15rem" }}>
          <strong style={{ fontSize: "var(--text-base)" }}>Task list</strong>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Priority, timing, project, and due-state in one readable list.
          </span>
        </div>
        <span
          style={{
            padding: "0.35rem 0.7rem",
            borderRadius: "999px",
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            fontWeight: 700,
          }}
        >
          {tasks.length} open
        </span>
      </div>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onComplete={onComplete}
          onEdit={onEdit}
          selected={selectedIds.has(task.id)}
          {...(onToggleSelect ? { onToggleSelect: () => onToggleSelect(task.id) } : {})}
        />
      ))}

      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            padding: "0.85rem 1rem",
            marginTop: "0.75rem",
            borderRadius: "16px",
            background: "linear-gradient(155deg, color-mix(in srgb, var(--accent) 82%, white 18%), var(--accent))",
            color: "var(--text-on-accent)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <span>{selectedIds.size} selected</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => void handleBulkComplete()}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              border: "none",
              background: "rgba(255, 255, 255, 0.2)",
              color: "var(--text-on-accent)",
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              transition: "background 180ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
          >
            Complete all
          </button>
          <button
            onClick={() => void handleBulkDelete()}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              border: "none",
              background: "rgba(255, 255, 255, 0.2)",
              color: "var(--text-on-accent)",
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              transition: "background 180ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
          >
            Delete all
          </button>
          <button
            onClick={onClearSelection}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "6px",
              border: "none",
              background: "rgba(255, 255, 255, 0.15)",
              color: "var(--text-on-accent)",
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              transition: "background 180ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)")}
          >
            Clear
          </button>
        </div>
      )}
    </section>
  );
}

export default TasksPanel;
