import type { Task } from "../../../../shared/types";

export interface BacklogColumnProps {
  tasks: Task[];
  onComplete: (id: string) => void;
  draggable?: boolean;
}

function priorityColor(priority: number): string {
  if (priority === 1) return "var(--state-overdue)";
  if (priority === 2) return "var(--state-warn)";
  if (priority === 3) return "var(--state-completed)";
  return "var(--text-muted)";
}

export function BacklogColumn({ tasks, onComplete, draggable = false }: BacklogColumnProps): JSX.Element {
  return (
    <section
      style={{
        padding: "1.1rem 1.15rem",
        borderRadius: "20px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.85rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <strong style={{ fontSize: "var(--text-base)" }}>Backlog</strong>
        {tasks.length > 0 && (
          <span
            style={{
              padding: "0.15rem 0.55rem",
              borderRadius: "999px",
              background: "var(--surface-2)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--text-secondary)",
            }}
          >
            {tasks.length}
          </span>
        )}
        {draggable && tasks.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--text-muted)", fontStyle: "italic" }}>
            drag to queue
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 1rem",
            borderRadius: "16px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border-subtle)",
            display: "grid",
            gap: "0.35rem",
            textAlign: "center",
          }}
        >
          <strong style={{ fontSize: "var(--text-sm)", color: "var(--state-completed)" }}>Backlog clear</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            Nothing unscheduled. Nice work keeping it clean.
          </span>
        </div>
      ) : (
        tasks.map((task) => {
          const dueDate = task.due_at ? new Date(task.due_at) : null;
          const overdue = dueDate !== null && dueDate.getTime() < Date.now();
          return (
            <div
              key={task.id}
              draggable={draggable}
              {...(draggable ? { onDragStart: (e: React.DragEvent) => e.dataTransfer.setData("text/task-id", task.id) } : {})}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "12px",
                background: "var(--surface-2)",
                border: "1px solid transparent",
                cursor: draggable ? "grab" : "default",
                transition: "border-color 120ms ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: priorityColor(task.priority),
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--text-sm)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {task.title}
                </span>
                {dueDate && (
                  <span style={{ fontSize: "var(--text-xs)", color: overdue ? "var(--state-overdue)" : "var(--text-muted)" }}>
                    {overdue ? "Overdue" : dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
              <button
                onClick={() => onComplete(task.id)}
                aria-label={`Mark ${task.title} complete`}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  lineHeight: 1,
                  color: "var(--state-completed)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                ✓
              </button>
            </div>
          );
        })
      )}
    </section>
  );
}

export default BacklogColumn;
