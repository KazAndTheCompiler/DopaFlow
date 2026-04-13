import { useState } from "react";
import type { Task } from "../../../../shared/types";

interface KanbanViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onStatusChange: (id: string, status: Task["status"]) => void;
}

const COLUMNS: Array<{ id: Task["status"]; label: string; color: string }> = [
  { id: "todo", label: "To do", color: "var(--text-secondary)" },
  { id: "in_progress", label: "In progress", color: "var(--accent)" },
  { id: "done", label: "Done", color: "var(--state-ok)" },
  { id: "cancelled", label: "Cancelled", color: "var(--state-overdue)" },
];

const PRIORITY_DOT: Record<number, string> = {
  1: "var(--state-overdue)",
  2: "var(--state-warn)",
  3: "var(--text-secondary)",
  4: "var(--border-subtle)",
  5: "var(--border-subtle)",
};

function KanbanCard({
  task,
  onEdit,
  onStatusChange,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onStatusChange: (id: string, status: Task["status"]) => void;
}): JSX.Element {
  const dotColor = PRIORITY_DOT[task.priority] ?? "var(--border-subtle)";
  const isDone = task.status === "done" || task.status === "cancelled";
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        padding: "0.65rem 0.75rem",
        borderRadius: "12px",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        display: "grid",
        gap: "0.4rem",
        cursor: "pointer",
        opacity: isDone ? 0.6 : 1,
        boxShadow: isHovered ? "var(--shadow-elevated)" : "none",
        transform: isHovered ? "translateY(-1px)" : "none",
        transition: "box-shadow 180ms ease, transform 180ms ease",
      }}
      onClick={() => onEdit(task)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
 if (e.key === "Enter" || e.key === " ") {
 onEdit(task);
}
}}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
            marginTop: "5px",
          }}
        />
        <span
          style={{
            flex: 1,
            fontWeight: 500,
            fontSize: "var(--text-sm)",
            lineHeight: 1.4,
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
      </div>

      {(task.due_at || task.tags.length > 0) && (
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", alignItems: "center", paddingLeft: "1.15rem" }}>
          {task.due_at && (
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {new Date(task.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} style={{ fontSize: "11px", color: "var(--accent)" }}>#{tag}</span>
          ))}
        </div>
      )}

      <div
        style={{ display: "flex", gap: "0.25rem", paddingLeft: "1.15rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {COLUMNS.filter((col) => col.id !== task.status).map((col) => (
          <button
            key={col.id}
            onClick={() => onStatusChange(task.id, col.id)}
            title={`Move to ${col.label}`}
            style={{
              padding: "0.1rem 0.4rem",
              borderRadius: "4px",
              border: `1px solid ${col.color}`,
              background: "transparent",
              color: col.color,
              fontSize: "10px",
              cursor: "pointer",
              fontWeight: 600,
              lineHeight: 1.6,
            }}
          >
            {col.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function KanbanView({ tasks, onEdit, onStatusChange }: KanbanViewProps): JSX.Element {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.9rem", alignItems: "start" }}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        return (
          <div
            key={col.id}
            style={{
              background: "var(--surface-2, var(--surface))",
              borderRadius: "16px",
              border: "1px solid var(--border-subtle)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: col.color }}>{col.label}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "0.1rem 0.45rem",
                  borderRadius: "999px",
                  background: `${col.color}22`,
                  color: col.color,
                }}
              >
                {colTasks.length}
              </span>
            </div>
            <div style={{ padding: "0.75rem", display: "grid", gap: "0.6rem", minHeight: "180px" }}>
              {colTasks.length === 0 && (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textAlign: "center", padding: "1rem 0", border: "1px dashed var(--border-subtle)", borderRadius: "12px", background: "color-mix(in srgb, var(--surface) 82%, white 18%)" }}>
                  Nothing parked here yet
                </div>
              )}
              {colTasks.map((task) => (
                <KanbanCard key={task.id} task={task} onEdit={onEdit} onStatusChange={onStatusChange} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
